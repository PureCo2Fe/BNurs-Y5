# 🖥️ BNurs Year 5 Study Guide

Personal study-guide hub for **HKUMed Bachelor of Nursing — Year 5** courses 🩺, built with **MkDocs + Material** and styled like a **classic 1984 Macintosh** ⚫⚪ (pixel fonts, pinstripe title bars, hard shadows — no default Material look).

🌐 **Live site:** <https://y5.note.co2fe.eu.org>

## 📚 Courses

| Emoji | Code | Title |
|:-----:|:-----|:------|
| 🧠 | NURS5602 | Clinical Reasoning in Practice |
| 🎗️ | NURS5601 | Oncology Nursing and Palliative Care |
| 👵 | NURS5600 | Nursing of Older Adults |
| 👑 | NURS5603 | Leadership, Management and Informatics |
| 🔬 | NURS5607 | Evidence-based Practice |

Each course has its own folder under `docs/` with an `index.md` landing page plus sub-pages. 🗂️

## 🛠️ Local preview

```bash
pip install -r requirements.txt
mkdocs serve
```

Then open <http://127.0.0.1:8000> 🎉. To validate a production build:

```bash
mkdocs build --strict
```

## 🚀 Deployment

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which installs `requirements.txt` and runs `mkdocs gh-deploy --force` — publishing to the `gh-pages` branch served by GitHub Pages.

## 🌍 Custom domain / DNS

`docs/CNAME` contains `y5.note.co2fe.eu.org`, so the custom domain is re-asserted on every deploy. On the DNS side, create a **CNAME record**:

```
y5.note  →  pureco2fe.github.io
```

## 📁 Layout

```
docs/
  index.md                       # 🏠 home
  CNAME                          # custom domain
  stylesheets/retro-mac.css      # 🖥️ classic Mac theme (grayscale everything)
  javascripts/mermaid-init.js    # grayscale mermaid theme (defensive)
  nurs5602-clinical-reasoning/   # 🧠
  nurs5601-oncology-palliative/  # 🎗️
  nurs5600-older-adults/         # 👵
  nurs5603-leadership-informatics/ # 👑
  nurs5607-evidence-based-practice/ # 🔬
mkdocs.yml
requirements.txt
.github/workflows/deploy.yml
```

Made with 💾 and ☕ by PureCo2Fe.
