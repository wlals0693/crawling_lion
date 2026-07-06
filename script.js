// =========================
// 전역 변수
// =========================

let quotesData = [];
let authorsData = {};
let activeObserver = null;

// =========================
// 페이지 로드 후 실행
// =========================

document.addEventListener('DOMContentLoaded', function () {
  loadData();

  const randomBtn = document.getElementById('randomBtn');
  const randomAuthor = document.getElementById('randomAuthor');
  const quoteViewer = document.getElementById('quoteViewer');

  randomBtn.addEventListener('click', showRandomQuote);

  randomAuthor.addEventListener('click', function () {
    const authorKey = randomAuthor.dataset.authorKey;

    if (authorKey) {
      openAuthorModal(authorKey);
    }
  });

  quoteViewer.addEventListener('click', function (event) {
    const button = event.target.closest('.author-detail-btn');

    if (!button) {
      return;
    }

    const authorKey = button.dataset.authorKey;
    openAuthorModal(authorKey);
  });

  document.querySelectorAll('[data-close-modal]').forEach(function (element) {
    element.addEventListener('click', closeAuthorModal);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeAuthorModal();
    }
  });
});

// =========================
// CSV 데이터 불러오기
// =========================

function loadData() {
  Promise.all([
    fetchCSV('quotes.csv'),
    fetchCSV('authors.csv').catch(function () {
      return '';
    }),
  ])
    .then(function ([quotesCsvText, authorsCsvText]) {
      quotesData = parseCSV(quotesCsvText);

      if (authorsCsvText.trim() !== '') {
        const authorsArray = parseCSV(authorsCsvText);

        authorsData = {};

        authorsArray.forEach(function (author) {
          authorsData[author.author_key] = author;
        });
      }

      showRandomQuote();
      renderQuoteCards(quotesData);
    })
    .catch(function (error) {
      console.error(error);

      document.getElementById('randomQuote').textContent =
        'CSV 데이터를 불러오지 못했습니다. Live Server 또는 localhost로 실행해주세요.';

      document.getElementById('randomAuthor').textContent = '-';
      document.getElementById('randomMeta').textContent = '-';

      document.getElementById('quoteViewer').innerHTML = `
        <article class="loading-card">
          <p>CSV 데이터를 불러오지 못했습니다.</p>
        </article>
      `;
    });
}

function fetchCSV(fileName) {
  return fetch(fileName).then(function (response) {
    if (!response.ok) {
      throw new Error(`${fileName} 파일을 불러오지 못했습니다.`);
    }

    return response.text();
  });
}

// =========================
// CSV 파싱
// =========================

function parseCSV(csvText) {
  csvText = csvText.replace(/^\uFEFF/, '');

  const rows = [];
  let currentRow = [];
  let currentValue = '';
  let insideQuotes = false;

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

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(function (header) {
    return header.trim();
  });

  const dataRows = rows.slice(1);

  return dataRows
    .filter(function (row) {
      return row.some(function (value) {
        return value.trim() !== '';
      });
    })
    .map(function (row) {
      const item = {};

      headers.forEach(function (header, index) {
        item[header] = row[index] ? row[index].trim() : '';
      });

      return item;
    });
}

// =========================
// 랜덤 명언 출력
// =========================

function showRandomQuote() {
  if (quotesData.length === 0) {
    return;
  }

  const randomIndex = Math.floor(Math.random() * quotesData.length);
  const quote = quotesData[randomIndex];

  document.getElementById('randomQuote').textContent = quote.quote || '-';

  const randomAuthor = document.getElementById('randomAuthor');
  const authorKey = quote.author_key || makeAuthorKeyFromUrl(quote.author_url);

  randomAuthor.textContent = `— ${quote.author || '-'}`;
  randomAuthor.dataset.authorKey = authorKey;
  randomAuthor.disabled = !authorKey;

  const bornDate = quote.born_date || '-';
  const bornLocation = quote.born_location || '-';

  document.getElementById('randomMeta').textContent =
    `${bornDate} / ${bornLocation}`;
}

// =========================
// 명언 카드 생성
// =========================

function renderQuoteCards(data) {
  const quoteViewer = document.getElementById('quoteViewer');

  quoteViewer.innerHTML = '';

  if (data.length === 0) {
    quoteViewer.innerHTML = `
      <article class="loading-card">
        <p>표시할 명언 데이터가 없습니다.</p>
      </article>
    `;

    return;
  }

  data.forEach(function (item, index) {
    const card = document.createElement('article');

    card.className = 'quote-card';
    card.dataset.index = index;

    const authorKey = item.author_key || makeAuthorKeyFromUrl(item.author_url);
    const tagText = item.tag ? `#${item.tag}` : '';

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
            ${escapeHTML(tagText)}
          </span>
        </div>

        <button
          class="author-detail-btn"
          type="button"
          data-author-key="${escapeHTML(authorKey)}"
        >
          저자 소개 보기
        </button>
      </div>
    `;

    quoteViewer.appendChild(card);
  });

  observeCards();
}

// =========================
// 현재 카드 강조
// =========================

function observeCards() {
  const quoteViewer = document.getElementById('quoteViewer');
  const cards = document.querySelectorAll('.quote-card');

  if (activeObserver) {
    activeObserver.disconnect();
  }

  if (cards.length === 0) {
    return;
  }

  cards[0].classList.add('active');

  activeObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          cards.forEach(function (card) {
            card.classList.remove('active');
          });

          entry.target.classList.add('active');
        }
      });
    },
    {
      root: quoteViewer,
      threshold: 0.6,
    },
  );

  cards.forEach(function (card) {
    activeObserver.observe(card);
  });
}

// =========================
// 저자 소개 모달
// =========================

function openAuthorModal(authorKey) {
  const modal = document.getElementById('authorModal');

  const authorInfo = authorsData[authorKey];

  if (authorInfo) {
    document.getElementById('modalAuthorName').textContent =
      authorInfo.author || '-';

    document.getElementById('modalBornDate').textContent =
      authorInfo.born_date || '-';

    document.getElementById('modalBornLocation').textContent =
      authorInfo.born_location || '-';

    document.getElementById('modalDescription').textContent =
      authorInfo.description || '저자 소개가 없습니다.';

    document.getElementById('modalAuthorLink').href =
      authorInfo.author_url || '#';
  } else {
    const quoteInfo = findQuoteByAuthorKey(authorKey);

    document.getElementById('modalAuthorName').textContent = quoteInfo
      ? quoteInfo.author
      : '저자 정보 없음';

    document.getElementById('modalBornDate').textContent = quoteInfo
      ? quoteInfo.born_date
      : '-';

    document.getElementById('modalBornLocation').textContent = quoteInfo
      ? quoteInfo.born_location
      : '-';

    document.getElementById('modalDescription').textContent =
      '저자 소개 데이터를 찾을 수 없습니다. authors.csv 파일이 생성되었는지 확인해주세요.';

    document.getElementById('modalAuthorLink').href = quoteInfo
      ? quoteInfo.author_url
      : '#';
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeAuthorModal() {
  const modal = document.getElementById('authorModal');

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

// =========================
// 유틸 함수
// =========================

function findQuoteByAuthorKey(authorKey) {
  return quotesData.find(function (quote) {
    const key = quote.author_key || makeAuthorKeyFromUrl(quote.author_url);
    return key === authorKey;
  });
}

function makeAuthorKeyFromUrl(url) {
  if (!url) {
    return '';
  }

  return url.replace(/\/$/, '').split('/').pop();
}

function escapeHTML(text) {
  if (!text) {
    return '';
  }

  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
