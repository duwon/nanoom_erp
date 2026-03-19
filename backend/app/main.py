from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from app.api.routes import router as api_router
from app.api.v1.router import router as api_v1_router
from app.config import get_settings
from app.core.store import InMemoryAppStore
from app.db.repository import MongoWorshipRepository
from app.modules.users.repository import InMemoryUserRepository, MongoUserRepository, UserRepository
from app.modules.users.schemas import SocialProvider
from app.services.oauth_service import HttpOAuthService, OAuthService
from app.services.worship_service import WorshipService
from app.ws.connection_manager import ConnectionManager


def create_app(
    service: WorshipService | None = None,
    user_repository: UserRepository | None = None,
    oauth_service: OAuthService | None = None,
) -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.store = InMemoryAppStore.bootstrap()
        mongo_client: AsyncIOMotorClient | None = None

        if service is not None:
            app.state.service = service
        else:
            mongo_client = AsyncIOMotorClient(settings.mongo_url)
            repository = MongoWorshipRepository(mongo_client[settings.mongo_db])
            ws_manager = ConnectionManager()
            app.state.mongo_client = mongo_client
            app.state.service = WorshipService(repository, ws_manager)
            await repository.ensure_indexes()
            await app.state.service.seed_defaults()

        if user_repository is not None:
            active_user_repository = user_repository
        elif mongo_client is not None:
            active_user_repository = MongoUserRepository(mongo_client[settings.mongo_db])
        else:
            active_user_repository = InMemoryUserRepository.bootstrap()

        await active_user_repository.ensure_indexes()
        if settings.auth_dev_seed_enabled:
            await active_user_repository.seed_master_user(
                provider=SocialProvider(settings.auth_dev_seed_provider),
                provider_user_id=settings.auth_dev_seed_provider_user_id,
                email=settings.auth_dev_seed_email,
                name=settings.auth_dev_seed_name,
            )
        app.state.user_repository = active_user_repository
        app.state.oauth_service = oauth_service or HttpOAuthService()

        yield

        if mongo_client is not None:
            mongo_client.close()

    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.state.store = InMemoryAppStore.bootstrap()
    if service is not None:
        app.state.service = service
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_prefix)
    app.include_router(api_v1_router, prefix="/api/v1")

    @app.websocket("/ws/display")
    async def display_socket(websocket: WebSocket) -> None:
        active_service: WorshipService = websocket.app.state.service
        manager = active_service.ws_manager
        await manager.connect(websocket)
        try:
            state = await active_service.get_display_state()
            await manager.send_event(
                websocket,
                "display.updated",
                state.model_dump(mode="json"),
            )
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            manager.disconnect(websocket)

    return app


app = create_app()
