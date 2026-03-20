from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from app.api.routes import router as api_router
from app.api.v1.router import router as api_v1_router
from app.config import get_settings
from app.core.store import InMemoryAppStore
from app.modules.udms.repository import InMemoryUdmsRepository, MongoUdmsRepository, UdmsRepository
from app.modules.udms.service import UdmsService
from app.modules.udms.targets import TargetRegistry, register_udms_targets
from app.modules.worship.adapters import (
    InMemoryScriptureAdapter,
    InMemorySongCatalogAdapter,
    NoopPresentationAdapter,
)
from app.modules.worship.repository import InMemoryWorshipRepository, MongoWorshipRepository, WorshipRepository
from app.modules.users.repository import InMemoryUserRepository, MongoUserRepository, UserRepository
from app.modules.users.schemas import SocialProvider
from app.modules.worship.udms_targets import register_worship_targets
from app.services.oauth_service import HttpOAuthService, OAuthService
from app.services.worship_service import WorshipService
from app.ws.connection_manager import ConnectionManager


def build_udms_service(repository: UdmsRepository, settings, worship_repository: WorshipRepository) -> UdmsService:
    registry = TargetRegistry()
    register_udms_targets(registry, repository)
    register_worship_targets(registry, worship_repository)
    return UdmsService(
        repository,
        settings.udms_storage_dir,
        settings.udms_max_upload_bytes,
        registry,
    )


def create_app(
    service: WorshipService | None = None,
    user_repository: UserRepository | None = None,
    udms_repository: UdmsRepository | None = None,
    oauth_service: OAuthService | None = None,
) -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.store = InMemoryAppStore.bootstrap()
        mongo_client: AsyncIOMotorClient | None = None
        active_worship_repository: WorshipRepository

        if service is not None:
            app.state.service = service
            active_worship_repository = service.repository
        else:
            mongo_client = AsyncIOMotorClient(settings.mongo_url)
            repository = MongoWorshipRepository(mongo_client[settings.mongo_db])
            ws_manager = ConnectionManager()
            app.state.mongo_client = mongo_client
            app.state.service = WorshipService(
                repository,
                ws_manager,
                song_adapter=InMemorySongCatalogAdapter(),
                scripture_adapter=InMemoryScriptureAdapter(),
                presentation_adapter=NoopPresentationAdapter(),
                timezone_name=settings.worship_timezone,
                frontend_app_url=settings.resolved_frontend_app_url,
            )
            active_worship_repository = repository
            await app.state.service.seed_defaults()

        if udms_repository is not None:
            active_udms_repository = udms_repository
        elif mongo_client is not None:
            active_udms_repository = MongoUdmsRepository(mongo_client[settings.mongo_db])
        else:
            active_udms_repository = InMemoryUdmsRepository.bootstrap()
        app.state.udms_service = build_udms_service(active_udms_repository, settings, active_worship_repository)
        await app.state.udms_service.seed_defaults()

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
    if udms_repository is not None:
        app.state.udms_service = build_udms_service(udms_repository, settings, service.repository if service is not None else InMemoryWorshipRepository.bootstrap())
    elif service is not None:
        app.state.udms_service = build_udms_service(InMemoryUdmsRepository.bootstrap(), settings, service.repository)
    if user_repository is not None:
        app.state.user_repository = user_repository
    elif service is not None:
        app.state.user_repository = InMemoryUserRepository.bootstrap()
    if oauth_service is not None:
        app.state.oauth_service = oauth_service
    elif service is not None:
        app.state.oauth_service = HttpOAuthService()
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
