# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Techreg autofill (userscript)

- Userscript file: `techreg-autofill.user.js`
- Install it in Tampermonkey.
- Open `https://techreg.gov.kz/index/`.
- In the floating panel:
  - set `API base` (default: `http://localhost:5000`)
  - set `Application ID`
  - click `Fetch + Fill`

Script fetches payload from:

- `GET /api/applications/:id/techreg-payload`

and attempts to fill fields by `id`.

Notes:

- Fields like FIO/IIN and kz-addresses are intentionally excluded in mapper metadata.
- `listbox` and `reglink` fields use interactive flow:
  - clear current value
  - type search text
  - select matching option from dropdown
- If CORS/network prevents fetch from `techreg.gov.kz` to local API, use `Fill JSON` and paste payload manually.
