import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import csv
import time


# =========================
# 기본 설정
# =========================

BASE_URL = "https://quotes.toscrape.com"

TAG = "inspirational"

START_URL = f"{BASE_URL}/tag/{TAG}/"

QUOTES_CSV_FILE = "quotes.csv"
AUTHORS_CSV_FILE = "authors.csv"


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
    """
    태그가 있으면 텍스트를 가져오고,
    태그가 없으면 빈 문자열을 반환한다.
    여러 줄 공백은 한 칸으로 정리한다.
    """

    if element is None:
        return ""

    text = element.get_text(" ", strip=True)
    text = " ".join(text.split())

    return text


# =========================
# 저자 key 만들기
# =========================

def make_author_key(author_url):
    """
    저자 URL에서 저자 key를 만든다.

    예:
    https://quotes.toscrape.com/author/Albert-Einstein
    → Albert-Einstein
    """

    return author_url.rstrip("/").split("/")[-1]


# =========================
# 저자 정보 가져오기
# =========================

author_cache = {}

def get_author_info(author_url, author_name=""):
    """
    저자 상세 페이지에 들어가서
    저자 key, 이름, 생년월일, 출생지, 소개문을 가져오는 함수
    """

    # 이미 방문한 저자라면 저장된 값 재사용
    if author_url in author_cache:
        return author_cache[author_url]

    soup = get_soup(author_url)

    author_key = make_author_key(author_url)

    # 저자 상세 페이지 안의 저자 이름
    page_author_name = get_text_safe(soup.select_one("h3.author-title"))

    # 목록 페이지에서 가져온 이름이 있으면 그걸 우선 사용
    if author_name:
        final_author_name = author_name
    else:
        final_author_name = page_author_name

    # 생년월일
    born_date = get_text_safe(soup.select_one("span.author-born-date"))

    # 출생지
    born_location = get_text_safe(soup.select_one("span.author-born-location"))

    # 저자 소개문
    description = get_text_safe(soup.select_one("div.author-description"))

    author_info = {
        "author_key": author_key,
        "author": final_author_name,
        "born_date": born_date,
        "born_location": born_location,
        "description": description,
        "author_url": author_url
    }

    # 같은 저자를 또 요청하지 않도록 저장
    author_cache[author_url] = author_info

    # 서버에 너무 빠르게 요청하지 않도록 잠깐 쉬기
    time.sleep(0.3)

    return author_info


# =========================
# 명언 크롤링
# =========================

def crawl_quotes():
    quotes_data = []

    # 저자 정보는 중복 없이 저장하기 위해 딕셔너리 사용
    authors_data = {}

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

            # 명언에 실제로 달린 태그들 전부 가져오기
            tag_elements = quote.select("a.tag")
            tags = [get_text_safe(tag) for tag in tag_elements]
            tag_text = ", ".join(tags)

            # 저자 상세 페이지 링크
            author_link_tag = quote.select_one("a[href^='/author/']")

            if author_link_tag:
                author_url = urljoin(BASE_URL, author_link_tag.get("href"))
            else:
                author_url = ""

            # 기본값
            author_key = ""
            born_date = ""
            born_location = ""

            # 저자 상세 페이지에 들어가서 추가 정보 가져오기
            if author_url:
                author_info = get_author_info(author_url, author_name)

                author_key = author_info["author_key"]
                born_date = author_info["born_date"]
                born_location = author_info["born_location"]

                # 저자 정보는 authors_data에 중복 없이 저장
                authors_data[author_key] = author_info

            # 명언 데이터 저장
            quotes_data.append({
                "quote": quote_text,
                "author": author_name,
                "author_key": author_key,
                "born_date": born_date,
                "born_location": born_location,
                "tag": tag_text,
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

    return quotes_data, authors_data


# =========================
# 명언 CSV 저장
# =========================

def save_quotes_to_csv(quotes_data):
    fieldnames = [
        "quote",
        "author",
        "author_key",
        "born_date",
        "born_location",
        "tag",
        "author_url"
    ]

    with open(QUOTES_CSV_FILE, "w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)

        writer.writeheader()

        for row in quotes_data:
            writer.writerow(row)

    print(f"명언 CSV 저장 완료: {QUOTES_CSV_FILE}")


# =========================
# 저자 CSV 저장
# =========================

def save_authors_to_csv(authors_data):
    fieldnames = [
        "author_key",
        "author",
        "born_date",
        "born_location",
        "description",
        "author_url"
    ]

    with open(AUTHORS_CSV_FILE, "w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)

        writer.writeheader()

        for author_info in authors_data.values():
            writer.writerow(author_info)

    print(f"저자 CSV 저장 완료: {AUTHORS_CSV_FILE}")


# =========================
# 실행
# =========================

def main():
    print("크롤링 시작")

    quotes_data, authors_data = crawl_quotes()

    print(f"총 {len(quotes_data)}개 명언 수집 완료")
    print(f"총 {len(authors_data)}명 저자 정보 수집 완료")

    save_quotes_to_csv(quotes_data)
    save_authors_to_csv(authors_data)

    print("크롤링 작업 완료")


if __name__ == "__main__":
    main()