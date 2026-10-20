/* «Посмотри в окно» — логика приложения.
   Без фреймворков: загрузка данных, выбор вида, музыка, состояния загрузки и ошибки. */

(function () {
  'use strict';

  var DATA_URL = 'data/cities.json';
  var STORAGE_KEY = 'posmotri:last-view';

  var el = {
    room: document.getElementById('room'),
    form: document.getElementById('finder'),
    city: document.getElementById('city'),
    window: document.getElementById('window'),
    photo: document.getElementById('photo'),
    caption: document.getElementById('view-caption'),
    viewTitle: document.getElementById('view-title'),
    viewCountry: document.getElementById('view-country'),
    loader: document.getElementById('loader'),
    empty: document.getElementById('empty'),
    error: document.getElementById('error'),
    errorText: document.getElementById('error-text'),
    retry: document.getElementById('retry'),
    status: document.getElementById('status'),
    credit: document.getElementById('credit'),
    play: document.getElementById('play'),
    player: document.querySelector('.player'),
    trackTitle: document.getElementById('track-title'),
    trackCredit: document.getElementById('track-credit'),
    another: document.getElementById('another'),
    audio: document.getElementById('audio')
  };

  var TIME_LABELS = {
    morning: 'утро',
    day: 'день',
    night: 'ночь'
  };

  var state = {
    cities: [],
    current: null,
    currentTime: 'day',
    audioUrl: ''
  };

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* --- Вспомогательные функции --- */

  function setStatus(text) {
    el.status.textContent = text || '';
  }

  function setRoomTime(time) {
    el.room.setAttribute('data-time', time);
  }

  function pickTime() {
    var checked = el.form.querySelector('input[name="time"]:checked');
    return checked ? checked.value : 'day';
  }

  function escapeText(value) {
    return String(value == null ? '' : value);
  }

  function saveLastView(cityId, time) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ city: cityId, time: time }));
    } catch (err) {
      /* приватный режим — просто не запоминаем */
    }
  }

  function readLastView() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (err) {
      return null;
    }
  }

  /* --- Данные --- */

  function loadData() {
    return fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (payload) {
        state.cities = (payload && payload.cities) || [];
        state.ambient = (payload && payload.ambient) || [];
        return state.cities;
      });
  }

  function fillCitySelect() {
    var fragment = document.createDocumentFragment();

    state.cities.forEach(function (city) {
      var option = document.createElement('option');
      option.value = city.id;
      option.textContent = city.name + (city.country ? ' · ' + city.country : '');
      fragment.appendChild(option);
    });

    el.city.appendChild(fragment);

    if (!state.cities.length) {
      el.city.disabled = true;
      el.city.options[0].textContent = 'Список городов недоступен';
    } else {
      el.city.value = state.cities[0].id;
    }
  }

  function findCity(id) {
    for (var i = 0; i < state.cities.length; i += 1) {
      if (state.cities[i].id === id) {
        return state.cities[i];
      }
    }
    return null;
  }

  /* --- Показ вида --- */

  function showLoader() {
    el.loader.hidden = false;
    el.error.hidden = true;
    el.empty.hidden = true;
    el.window.setAttribute('aria-busy', 'true');
    el.photo.classList.remove('is-loaded');
  }

  function showError(message) {
    el.loader.hidden = true;
    el.error.hidden = false;
    el.window.setAttribute('aria-busy', 'false');
    el.photo.classList.remove('is-loaded', 'is-drifting');
    el.errorText.textContent = message || 'Не удалось загрузить фотографию. Проверьте соединение и попробуйте ещё раз.';
    setStatus('Окно не открылось');
  }

  function hideOverlays() {
    el.loader.hidden = true;
    el.error.hidden = true;
    el.window.setAttribute('aria-busy', 'false');
  }

  function renderCredit(view) {
    if (!view || !view.source) {
      el.credit.textContent = '';
      return;
    }
    el.credit.innerHTML = '';

    var label = document.createElement('span');
    label.textContent = 'Фото: ' + escapeText(view.author || 'автор не указан') + ' · ' + escapeText(view.license || 'лицензия не указана') + ' · ';

    var link = document.createElement('a');
    link.href = view.source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'источник';

    el.credit.appendChild(label);
    el.credit.appendChild(link);
  }

  function showView(city, time) {
    var view = city.views && city.views[time];

    if (!view || !view.image) {
      showError('Для этого города и времени нет фотографии. Выберите другой вариант.');
      return;
    }

    state.current = city;
    state.currentTime = time;

    setRoomTime(time);
    showLoader();
    setStatus('Открываем окно: ' + city.name + ', ' + TIME_LABELS[time]);

    el.photo.classList.remove('is-drifting');
    el.photo.alt = city.name + ', ' + TIME_LABELS[time] + '. Вид из окна.';

    var source = view.image;
    el.photo.onload = function () {
      window.clearTimeout(timer);
      hideOverlays();
      el.empty.hidden = true;
      el.photo.classList.add('is-loaded');
      if (!reducedMotion.matches) {
        el.photo.classList.add('is-drifting');
      }
      el.caption.hidden = false;
      el.viewTitle.textContent = city.name;
      el.viewCountry.textContent = city.country || '';
      renderCredit(view);
      setStatus('Окно найдено: ' + city.name + ', ' + TIME_LABELS[time]);
    };

    el.photo.onerror = function () {
      window.clearTimeout(timer);
      showError('Фотография не загрузилась. Возможно, нет связи с источником снимка.');
    };

    var timer = window.setTimeout(function () {
      if (!el.photo.complete) {
        showError('Ответ от источника снимка приходит слишком долго. Попробуйте ещё раз.');
      }
    }, 12000);

    el.photo.src = source;

    saveLastView(city.id, time);
    playTrackFor(time);
  }

  /* --- Музыка --- */

  function playTrackFor(time) {
    var ambient = state.ambient || {};
    var track = ambient[time];

    if (!track) {
      var keys = Object.keys(ambient);
      track = keys.length ? ambient[keys[0]] : null;
    }

    if (!track) {
      el.trackTitle.textContent = 'Музыка недоступна';
      el.trackCredit.textContent = 'Фоновые дорожки не подключены';
      return;
    }

    state.audioUrl = track.url;

    el.trackTitle.textContent = track.title || 'Без названия';
    el.trackCredit.textContent = [track.author, track.license].filter(Boolean).join(' · ');

    if (el.audio.src !== track.url) {
      el.audio.src = track.url;
      el.audio.load();
    }
  }

  function togglePlay() {
    if (!el.audio.src) {
      setStatus('Сначала найдите окно — тогда появится музыка');
      return;
    }

    if (el.audio.paused) {
      var attempt = el.audio.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(function () {
          setStatus('Браузер не дал запустить музыку. Нажмите ещё раз.');
        });
      }
    } else {
      el.audio.pause();
    }
  }

  function syncPlayState() {
    var playing = !el.audio.paused;
    el.play.classList.toggle('is-playing', playing);
    el.play.setAttribute('aria-label', playing ? 'Выключить музыку' : 'Включить музыку');
    el.player.classList.toggle('is-playing', playing);
  }

  /* --- События --- */

  el.form.addEventListener('click', function (event) {
    if (event.target.closest('#find')) {
      event.preventDefault();
      findWindow();
    }
  });

  el.form.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      findWindow();
    }
  });

  function findWindow() {
    var city = findCity(el.city.value);

    if (!city) {
      setStatus('Выберите город из списка');
      el.city.focus();
      return;
    }

    showView(city, pickTime());
  }

  el.retry.addEventListener('click', function () {
    if (state.current) {
      showView(state.current, state.currentTime);
    }
  });

  el.another.addEventListener('click', function () {
    if (state.cities.length < 2) {
      setStatus('Других городов пока нет');
      return;
    }

    var pool = state.cities.filter(function (city) {
      return !state.current || city.id !== state.current.id;
    });

    var next = pool[Math.floor(Math.random() * pool.length)];
    el.city.value = next.id;
    showView(next, pickTime());
  });

  el.play.addEventListener('click', togglePlay);
  el.audio.addEventListener('play', syncPlayState);
  el.audio.addEventListener('pause', syncPlayState);
  el.audio.addEventListener('error', function () {
    el.trackTitle.textContent = 'Музыка не загрузилась';
    el.trackCredit.textContent = 'Дорожка недоступна, окно работает и без неё';
  });

  /* --- Запуск --- */

  loadData()
    .then(function () {
      fillCitySelect();

      var last = readLastView();
      var restored = last && findCity(last.city);

      if (restored) {
        el.city.value = restored.id;
        var radio = el.form.querySelector('input[name="time"][value="' + (last.time || 'day') + '"]');
        if (radio) {
          radio.checked = true;
        }
        showView(restored, pickTime());
      } else {
        hideOverlays();
        el.photo.removeAttribute('src');
        el.photo.alt = '';
        setStatus('Выберите город и время суток, затем нажмите «Найти окно»');
      }
    })
    .catch(function () {
      el.city.disabled = true;
      el.city.options[0].textContent = 'Не удалось загрузить список городов';
      showError('Список городов не загрузился. Обновите страницу — данные лежат в data/cities.json.');
    });
})();
