# CoderGosha — сайт

Статический сайт на [Eleventy](https://www.11ty.dev/) и Tailwind CSS.

## Требования

- Node.js 22 LTS (см. `.nvmrc`)

```bash
nvm use
```

## Команды

| Команда | Описание |
|---------|----------|
| `npm run sync` | Собрать `src/` из `templates/` и `content/` |
| `npm run dev` | Разработка с hot reload на http://localhost:8080 |
| `npm run build` | Сборка в `dist/` |
| `npm run preview` | Просмотр собранного `dist/` |
| `npm run lint` | Проверка Node-скриптов |

## Структура

```text
content/      — тексты и данные страниц (ru + *.en.*)
templates/    — шаблоны, стили, изображения
src/          — сгенерированный вход Eleventy (не коммитится)
dist/         — результат сборки (не коммитится)
_archive_bio/ — архив старого проекта (источник, не трогать)
```

## Деплой

### GitHub Pages (автоматически)

При push в `main` workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) собирает сайт и публикует `dist/` в ветку `gh-pages`.

В настройках репозитория (**Settings → Pages**) укажите источник **Deploy from a branch**, ветка `gh-pages`, корень `/`. Домен `codergosha.com` задаётся через `cname` в workflow (нужна DNS-запись на GitHub Pages).

### Вручную

После `npm run build` можно залить содержимое каталога `dist/` на любой статический хостинг.
