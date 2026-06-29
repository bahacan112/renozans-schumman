# renozans-schumman — backend

Schumann Rezonansı uygulamasının üyelik + bildirim API'si (Hono + TypeScript).
Kullanıcı deposu olarak self-hosted **Logto** kullanır; oturum için kendi JWT'sini verir.

## Çalıştırma (lokal)

```bash
cp .env.example .env   # değerleri doldur
npm install
npm run dev            # http://localhost:4000
```

## Uçlar

| Method | Path | Açıklama |
|--------|------|----------|
| GET  | `/health` | Sağlık kontrolü |
| POST | `/auth/register` | E-posta + şifre ile kayıt |
| POST | `/auth/login` | Giriş |
| POST | `/auth/google` | Google ID token ile giriş |
| POST | `/auth/forgot-password` | Sıfırlama kodu e-postası gönderir |
| POST | `/auth/reset-password` | Kod + yeni şifre |
| GET  | `/me` | Profil + premium durumu (JWT) |
| POST | `/me/premium` | Premium aktive et (JWT) |
| GET  | `/me/notifications` | In-app bildirim listesi + okunmamış sayısı (JWT) |
| POST | `/me/notifications/read` | Okundu işaretle (JWT) |
| POST | `/me/push-token` | FCM cihaz token'ı kaydet (JWT) |
| POST | `/internal/kp-alert` | n8n tetikler (`X-Internal-Secret`) |

## Ortam değişkenleri

Tümü `.env.example` içinde. Production'da bunları **Coolify panelinden** girin (repoya `.env` koymayın):

`LOGTO_ENDPOINT`, `LOGTO_M2M_CLIENT_ID`, `LOGTO_M2M_CLIENT_SECRET`, `GOOGLE_WEB_CLIENT_ID`,
`SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`, `JWT_SECRET`, `INTERNAL_TRIGGER_SECRET`,
`N8N_BASE_URL`, `N8N_API_KEY`, `PORT`, `DEV_EXPOSE_RESET_CODE`.

## Deploy (Coolify)

- Bu repo'dan **Dockerfile** ile build edilir; uygulama `PORT` (varsayılan 4000) üzerinde dinler.
- Bildirimlerin yeniden başlatmada kaybolmaması için **`/app/data`** dizinine kalıcı volume bağlayın.
- Env değişkenlerini Coolify'da tanımlayın; `.env` repoya dahil **değildir**.
