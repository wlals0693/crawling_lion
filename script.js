// =========================
// 전역 변수
// =========================

let quotesData = [];
let filteredData = [];
let activeCardIndex = 0;

// =========================
// 페이지 로드 후 실행
// =========================

document.addEventListener('DOMContentLoaded', function () {
  loadCSV();

  const randomBtn = document.getElementById('randomBtn');
  const searchInput = document.getElementById('searchInput');

  randomBtn.addEventListener('click', showRandomQuote);

  searchInput.addEventListener('input', function () {
    filterQuotes(this.value);
  });
});

// =========================
// CSV 파일 불러오기
// =========================

function loadCSV() {
  fetch('quotes.csv')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('CSV 파일을 불러오지 못했습니다.');
      }

      return response.text();
    })
    .then(function (csvText) {
      quotesData = parseCSV(csvText);
      filteredData = quotesData;

      showRandomQuote();
      renderQuoteCards(filteredData);
      updatePageInfo();
    })
    .catch(function (error) {
      console.error(error);

      document.getElementById('randomQuote').textContent =
        'CSV 파일을 불러오지 못했습니다. Live Server 또는 localhost로 실행해주세요.';

      document.getElementById('quoteViewer').innerHTML = `
                <div class="loading-card">
                    <p>CSV 파일을 불러오지 못했습니다.</p>
                </div>
            `;
    });
}

// =========================
// CSV 문자열을 객체 배열로 변환
// =========================

function parseCSV(csvText) {
  const rows = [];
  let currentRow = [];
  let currentValue = '';
  let insideQuotes = false;

  // utf-8-sig로 저장된 CSV의 BOM 제거
  csvText = csvText.replace(/^\uFEFF/, '');

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentValue += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (currentValue !== '' || currentRow.length > 0) {
        currentRow.push(currentValue);
        rows.push(currentRow);
        currentRow = [];
        currentValue = '';
      }

      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentValue += char;
    }
  }

  if (currentValue !== '' || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return dataRows.map(function (row) {
    const item = {};

    headers.forEach(function (header, index) {
      item[header.trim()] = row[index] ? row[index].trim() : '';
    });

    return item;
  });
}

// =========================
// 상단 랜덤 명언 출력
// =========================

function showRandomQuote() {
  if (quotesData.length === 0) {
    return;
  }

  const randomIndex = Math.floor(Math.random() * quotesData.length);
  const quote = quotesData[randomIndex];

  document.getElementById('randomQuote').textContent = quote.quote;
  document.getElementById('randomAuthor').textContent = `— ${quote.author}`;

  document.getElementById('randomMeta').textContent =
    `${quote.born_date} / ${quote.born_location}`;
}

// =========================
// 전체 명언 카드 생성
// =========================

function renderQuoteCards(data) {
  const quoteViewer = document.getElementById('quoteViewer');

  quoteViewer.innerHTML = '';

  if (data.length === 0) {
    quoteViewer.innerHTML = `
            <div class="loading-card">
                <p>검색 결과가 없습니다.</p>
            </div>
        `;

    updateCurrentCardInfo(0, 0);
    return;
  }

  data.forEach(function (item, index) {
    const card = document.createElement('article');

    card.className = 'quote-card';
    card.dataset.index = index;

    card.innerHTML = `
            <div class="quote-index">
                ${String(index + 1).padStart(2, '0')}
            </div>

            <p class="quote-text">
                ${escapeHTML(item.quote)}
            </p>

            <div class="quote-bottom">
                <div>
                    <p class="quote-author">
                        ${escapeHTML(item.author)}
                    </p>

                    <p class="quote-meta">
                        ${escapeHTML(item.born_date)}<br>
                        ${escapeHTML(item.born_location)}
                    </p>

                    <span class="quote-tag">
                        #${escapeHTML(item.tag)}
                    </span>
                </div>

                <a 
                    class="quote-link" 
                    href="${escapeHTML(item.author_url)}" 
                    target="_blank"
                >
                    저자 페이지
                </a>
            </div>
        `;

    quoteViewer.appendChild(card);
  });

  observeCards();
  updateCurrentCardInfo(1, data.length);
}

// =========================
// 현재 보이는 카드 감지
// =========================

function observeCards() {
  const quoteViewer = document.getElementById('quoteViewer');
  const cards = document.querySelectorAll('.quote-card');

  if (cards.length === 0) {
    return;
  }

  cards[0].classList.add('active');

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          cards.forEach(function (card) {
            card.classList.remove('active');
          });

          entry.target.classList.add('active');

          activeCardIndex = Number(entry.target.dataset.index);
          updateCurrentCardInfo(activeCardIndex + 1, cards.length);
        }
      });
    },
    {
      root: quoteViewer,
      threshold: 0.6,
    },
  );

  cards.forEach(function (card) {
    observer.observe(card);
  });
}

// =========================
// 검색 기능
// =========================

function filterQuotes(keyword) {
  const lowerKeyword = keyword.toLowerCase().trim();

  if (lowerKeyword === '') {
    filteredData = quotesData;
  } else {
    filteredData = quotesData.filter(function (item) {
      return (
        item.quote.toLowerCase().includes(lowerKeyword) ||
        item.author.toLowerCase().includes(lowerKeyword) ||
        item.born_date.toLowerCase().includes(lowerKeyword) ||
        item.born_location.toLowerCase().includes(lowerKeyword) ||
        item.tag.toLowerCase().includes(lowerKeyword)
      );
    });
  }

  renderQuoteCards(filteredData);
  updatePageInfo();
}

// =========================
// 상단 태그 / 총 개수 표시
// =========================

function updatePageInfo() {
  const tagInfo = document.getElementById('tagInfo');
  const totalCount = document.getElementById('totalCount');

  if (quotesData.length === 0) {
    tagInfo.textContent = 'Tag: -';
    totalCount.textContent = 'Total: 0 quotes';
    return;
  }

  const tagName = quotesData[0].tag || '-';

  tagInfo.textContent = `Tag: ${tagName}`;
  totalCount.textContent = `Total: ${filteredData.length} / ${quotesData.length} quotes`;
}

// =========================
// 현재 카드 번호 표시
// =========================

function updateCurrentCardInfo(current, total) {
  const currentCardInfo = document.getElementById('currentCardInfo');

  currentCardInfo.textContent = `${current} / ${total}`;
}

// =========================
// HTML 특수문자 처리
// =========================

function escapeHTML(text) {
  if (!text) {
    return '';
  }

  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
