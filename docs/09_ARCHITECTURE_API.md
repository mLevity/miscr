# Архитектура, API и порядок реализации
## Предлагаемая основа
TypeScript + React + Vite, обычный CSS с токенами и небольшим собственным набором компонентов. Это решение проекта, не требование конкретного SaaS. Версии зависимостей фиксируются lockfile в момент создания репозитория; не использовать `latest` в воспроизводимой сборке. Возможен другой стек при сохранении контрактов и автономности. Backend для MVP не требуется; статический хостинг должен корректно отдавать deep links.

Модули: catalog domain; map domain; collection domain; calculation domain; data adapters; asset registry; UI components. Чистое математическое ядро не импортирует React, DOM, localStorage или fetch. Компоненты принимают данные и вызывают use cases; они не содержат собственную формулу урона. Версии правил и данных передаются в результат.

## Организация кода
| Каталог | Ответственность |
|---|---|
| `src/domain/catalog` | Модели, aliases, фильтрация, сортировка |
| `src/domain/maps` | Преобразования, расписания, кластеры |
| `src/domain/calculations` | Статы, урон, ребонус, эффекты |
| `src/domain/collection` | Поимки, формы, прогресс, импорт |
| `src/data/static` | Чтение локальных версионируемых JSON |
| `src/data/http` | Будущий API adapter |
| `src/storage` | IndexedDB, транзакции, миграции |
| `src/ui` | Базовые компоненты и токены |
| `src/features` | Экраны и сценарии |
| `src/workers` | Серийный ребонус и тяжёлые индексы |
| `public/data/<version>` | Опубликованные immutable данные |
| `public/assets` | Локальные оптимизированные ассеты |

Не разделять один и тот же фильтр на независимые реализации для карты/каталога/выбора мискрита. Использовать общий предикат с различными включёнными группами. Никаких прямых запросов с клиента к Companion/Hub/itch: они нужны для сбора данных, не как runtime-зависимость. Источники могут менять CORS и формат.

## Репозитории
`CatalogRepository`: manifest, listFamilies(query), getFamily(id), getAbilities(familyId), getRelics(). `MapRepository`: listLocations(), getMap(id), getSpawns(query), getMarkers(mapId). `ProfileRepository`: getEntry, patchEntry, listEntries, savePreset, exportProfile, importProfile. `RulesRepository`: getRules(version).

Публичные методы возвращают Promises уже в static-режиме, чтобы HTTP не менял компоненты. У метода единый тип ошибки: code, message, details. Domain objects не содержат fetch Response. ListResult содержит items, total, nextCursor, datasetVersion. На текущих420 семействах допустим клиентский поиск по компактному индексу. Детальные abilities загружаются отдельно, чтобы не тащить все тексты на первый экран.

## Будущие endpoints
| Метод и путь | Ответ |
|---|---|
| GET `/api/v1/manifest` | Версии, hashes, доступные наборы |
| GET `/api/v1/miscrits` | Каталог с фильтрами/пагинацией |
| GET `/api/v1/miscrits/{id}` | Семейство, формы, связанные IDs |
| GET `/api/v1/abilities?familyId=...` | Навыки и версии |
| GET `/api/v1/locations` | Локации и зоны |
| GET `/api/v1/maps/{id}` | Изображение/тайлы, размеры, маркеры |
| GET `/api/v1/spawns` | Записи по существу/локации/дню |
| GET `/api/v1/relics` | Модификаторы и доступность |
| GET `/api/v1/collections` | Игровые коллекции |
| GET `/api/v1/rules/{version}` | Версионированные правила |
| GET/PATCH `/api/v1/me/collection` | Будущие личные данные |
| GET/PUT `/api/v1/me/presets/{id}` | Будущие личные пресеты |

GET-list query: q, elements, elementMode, rarity, locationId, areaId, day/days, sort, cursor, limit. locationId/areaId и days передаются CSV-массивом, внутри группы OR. day — один день, days — несколько; одновременно оба недопустимы (400). Расширенные stat/tag filters перечислены в OpenAPI. limit default50, max200; cursor непрозрачный, привязан к версии данных и сортировке. Фильтры «пойман» в MVP локальные; сервер не принимает произвольный userId для чужой коллекции. При сортировке статистики число рассчитывается на одной версии rules.

Пример ответа:
```json
{"items": [{"id": "miscrit:1", "name": "Flue"}], "total": 1, "nextCursor": null, "datasetVersion": "2026-09-15.1"}
```
Пример ошибки:
```json
{"error": {"code": "INVALID_FILTER", "message": "Недопустимый день недели", "details": {"field": "day"}}}
```

HTTP400 неверный ввод,401 нужен вход,403 нет прав,404 нет сущности,409 конфликт версии,413 слишком большой payload,429 лимит,5xx серверная ошибка. Личные записи: ETag/revision + If-Match, Idempotency-Key для повторяемых mutations. Не делать last-write-wins между устройствами по ненадёжным пользовательским часам. Публичные ETag/If-None-Match уменьшают скачивания. `schemas/openapi.json` — стартовый контракт публичного слоя; private/auth endpoints реализуются позднее по этой модели.

## Статическая публикация
SPA fallback только на HTML-маршруты, а не на `/assets/missing.png` или JSON: отсутствующий ассет должен возвращать404, не index.html с200. Для поисковиков желательно пререндерить карточки семейства и каталог; dynamic filter combinations имеют canonical к базовому разделу, noindex для бесконечных комбинаций. Уникальные title, description и alt без механического SEO-спама. Не требовать JS, чтобы увидеть ссылку на карточку, если используется prerender.

## Автономный режим
Сам сайт остаётся обычным веб-сайтом. Offline support в MVP: уже загруженные справочники и личные данные продолжают читаться; холодный первый запуск без сети не обещается, если приложение ранее не установлено/не закэшировано. Опциональная кнопка «Сохранить карты для офлайн» сообщает размер. Service worker версионирует app shell и публичные данные и никогда не кэширует ответы будущих `/me` в общем публичном кэше.

## Доставка исполнителем
Репозиторий; lockfile; инструкция запуска и build; пример env без секретов; data import script; schemas; tests; отчёт недостающих ассетов; размер build по маршрутам; desktop/mobile screenshots; список неподдержанных effect handlers; инструкция обновления JSON→API и rollback версии. Предложенные reference HTML этого пакета служат проверкой данных и математики, а не заменой финального React-приложения.
