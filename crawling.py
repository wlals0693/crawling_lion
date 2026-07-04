import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import csv
import time


# =========================
# 기본 설정
# =========================

BASE_URL = "https://quotes.toscrape.com"

# 원하는 태그 하나 선택
# 예: love, life, humor, books, reading, friendship 등
TAG = "love"

START_URL = f"{BASE_URL}/tag/{TAG}/"
CSV_FILE = "quotes.csv"


# =========================
# HTML 가져오기
# =========================

def get_soup(url):
    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    response = requests.get(url, headers=headers)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    return soup


# =========================
# 텍스트 안전하게 가져오기
# =========================

def get_text_safe(element):
    if element is None:
        return ""

    return element.get_text(strip=True)


# =========================
# 저자 정보 가져오기
# =========================

author_cache = {}

def get_author_info(author_url):
    """
    저자 상세 페이지에 들어가서
    생년월일과 출생지를 가져오는 함수
    """

    # 이미 방문한 저자라면 저장된 값 재사용
    if author_url in author_cache:
        return author_cache[author_url]

    soup = get_soup(author_url)

    born_date = get_text_safe(soup.select_one("span.author-born-date"))
    born_location = get_text_safe(soup.select_one("span.author-born-location"))

    author_info = {
        "born_date": born_date,
        "born_location": born_location
    }

    author_cache[author_url] = author_info

    # 서버에 너무 빠르게 요청하지 않도록 잠깐 쉬기
    time.sleep(0.3)

    return author_info


# =========================
# 명언 크롤링
# =========================

def crawl_quotes():
    quotes_data = []

    current_url = START_URL
    page_number = 1

    while current_url:
        print(f"{page_number}페이지 크롤링 중: {current_url}")

        soup = get_soup(current_url)

        # 한 페이지 안의 명언 박스들
        quote_boxes = soup.select("div.quote")

        for quote in quote_boxes:
            # 명언 내용
            quote_text = get_text_safe(quote.select_one("span.text"))

            # 저자 이름
            author_name = get_text_safe(quote.select_one("small.author"))

            # 저자 상세 페이지 링크
            author_link_tag = quote.select_one("a[href^='/author/']")

            if author_link_tag:
                author_url = urljoin(BASE_URL, author_link_tag.get("href"))
            else:
                author_url = ""

            # 저자 상세 페이지에서 생년월일, 출생지 가져오기
            if author_url:
                author_info = get_author_info(author_url)
                born_date = author_info["born_date"]
                born_location = author_info["born_location"]
            else:
                born_date = ""
                born_location = ""

            quotes_data.append({
                "quote": quote_text,
                "author": author_name,
                "born_date": born_date,
                "born_location": born_location,
                "tag": TAG,
                "author_url": author_url
            })

        # 다음 페이지 찾기
        next_button = soup.select_one("li.next a")

        if next_button:
            current_url = urljoin(current_url, next_button.get("href"))
            page_number += 1
            time.sleep(0.5)
        else:
            current_url = None

    return quotes_data


# =========================
# CSV 저장
# =========================

def save_to_csv(quotes_data):
    fieldnames = [
        "quote",
        "author",
        "born_date",
        "born_location",
        "tag",
        "author_url"
    ]

    with open(CSV_FILE, "w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)

        writer.writeheader()

        for row in quotes_data:
            writer.writerow(row)

    print(f"CSV 저장 완료: {CSV_FILE}")


# =========================
# 실행
# =========================

def main():
    print("크롤링 시작")

    quotes_data = crawl_quotes()

    print(f"총 {len(quotes_data)}개 수집 완료")

    save_to_csv(quotes_data)

    print("크롤링 작업 완료")


if __name__ == "__main__":
    main()