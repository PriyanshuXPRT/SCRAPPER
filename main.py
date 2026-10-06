#!/usr/bin/env python3
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import urlopen, urlretrieve


class ImageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.sources: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "img":
            return

        for name, value in attrs:
            if name.lower() == "src" and value:
                self.sources.append(value)
                break


def _filename_from_url(image_url: str, index: int) -> str:
    path = Path(urlparse(image_url).path)
    if path.name:
        return path.name
    return f"image_{index}.jpg"


def download_images(page_url: str, output_dir: str = "downloads") -> int:
    target_dir = Path(output_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    with urlopen(page_url) as response:
        html = response.read().decode("utf-8", errors="ignore")

    parser = ImageParser()
    parser.feed(html)

    image_urls = []
    seen = set()
    for src in parser.sources:
        absolute_url = urljoin(page_url, src)
        if absolute_url in seen:
            continue
        seen.add(absolute_url)
        image_urls.append(absolute_url)

    for index, image_url in enumerate(image_urls, start=1):
        filename = _filename_from_url(image_url, index)
        destination = target_dir / filename
        urlretrieve(image_url, destination)

    return len(image_urls)


def main() -> None:
    page_url = input("Enter webpage URL: ").strip()
    if not page_url:
        print("Please provide a valid URL.")
        return

    downloaded = download_images(page_url)
    print(f"Done. Downloaded {downloaded} image(s) into ./downloads")


if __name__ == "__main__":
    main()
