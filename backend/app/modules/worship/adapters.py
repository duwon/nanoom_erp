from __future__ import annotations

from typing import Protocol

from app.modules.worship.schemas import WorshipScriptureLookupResponse, WorshipSongLookupItem


class SongCatalogAdapter(Protocol):
    async def search(self, query: str) -> list[WorshipSongLookupItem]: ...


class ScriptureAdapter(Protocol):
    async def lookup(
        self,
        *,
        book: str,
        chapter: int,
        verse_start: int,
        verse_end: int | None = None,
        translation: str = "KRV",
    ) -> WorshipScriptureLookupResponse: ...


class PresentationAdapter(Protocol):
    async def push(self, payload: dict) -> None: ...


class InMemorySongCatalogAdapter:
    def __init__(self) -> None:
        self.items = [
            WorshipSongLookupItem(
                id="song-1",
                title="경배와 찬양",
                artist="예배팀",
                recent_use_count=12,
                tags=["praise", "opening"],
            ),
            WorshipSongLookupItem(
                id="song-2",
                title="주님 다시 오실 때까지",
                artist="찬송가",
                recent_use_count=8,
                tags=["closing", "hymn"],
            ),
            WorshipSongLookupItem(
                id="song-3",
                title="모든 호흡이 주를 찬양해",
                artist="예배팀",
                recent_use_count=15,
                tags=["praise", "chorus"],
            ),
            WorshipSongLookupItem(
                id="song-4",
                title="은혜",
                artist="워십",
                recent_use_count=6,
                tags=["special", "offertory"],
            ),
        ]

    async def search(self, query: str) -> list[WorshipSongLookupItem]:
        lowered = query.strip().lower()
        if not lowered:
            return self.items[:3]
        return [
            item
            for item in self.items
            if lowered in item.title.lower()
            or lowered in item.artist.lower()
            or any(lowered in tag.lower() for tag in item.tags)
        ]


class InMemoryScriptureAdapter:
    def __init__(self) -> None:
        self.verses = {
            ("요한복음", 3, 16): "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니",
            ("요한복음", 3, 17): "이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라",
            ("시편", 23, 1): "여호와는 나의 목자시니 내게 부족함이 없으리로다",
            ("시편", 23, 2): "그가 나를 푸른 초장에 누이시며 쉴 만한 물 가로 인도하시는도다",
            ("로마서", 8, 28): "하나님을 사랑하는 자 곧 그의 뜻대로 부르심을 입은 자들에게는 모든 것이 합력하여 선을 이루느니라",
        }

    async def lookup(
        self,
        *,
        book: str,
        chapter: int,
        verse_start: int,
        verse_end: int | None = None,
        translation: str = "KRV",
    ) -> WorshipScriptureLookupResponse:
        from app.modules.worship.schemas import WorshipSlide

        end = verse_end or verse_start
        lines: list[str] = []
        for verse in range(verse_start, end + 1):
            lines.append(self.verses.get((book, chapter, verse), f"{book} {chapter}:{verse} 본문 예시"))
        reference = f"{book} {chapter}:{verse_start}" if end == verse_start else f"{book} {chapter}:{verse_start}-{end}"
        slides = [
            WorshipSlide(
                id=f"scripture-{index}",
                label=f"{reference} ({index + 1}/{len(lines)})",
                lines=[line],
                slide_template_key="scripture-main",
                notes="",
            )
            for index, line in enumerate(lines)
        ]
        return WorshipScriptureLookupResponse(
            reference=reference,
            text="\n".join(lines),
            translation=translation,
            slides=slides,
        )


class NoopPresentationAdapter:
    async def push(self, payload: dict) -> None:
        del payload
        return None
