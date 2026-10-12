# GÜ Kulüpler — Web

Gümüşhane Üniversitesi öğrenci kulüpleri uygulamasının **web sürümü**. Mobil uygulama (Flutter) ile **aynı Firebase projesini** (`gu-kulupler`) ve aynı veri sözleşmesini kullanır; bir kullanıcı web'de katıldığı kulübü telefonda da görür.

TÜBİTAK 2209-A Üniversite Öğrencileri Araştırma Projeleri kapsamında geliştirilmektedir.

| | |
|---|---|
| Arayüz | React 18 + TypeScript + Vite 5 |
| Backend | Firebase Auth · Cloud Firestore · Cloud Storage (Flutter uygulamasıyla ortak) |
| Tasarım | Flutter tasarım dosyalarıyla birebir (ekran kimlikleri `CLB-03`, `MGT-05` … aynıdır) |
| Diller | Türkçe (varsayılan) ve İngilizce |
| Görünüm | Telefon (alt sekme çubuğu) ve masaüstü (yan menü), açık / koyu tema |

## Özellikler

- **Öğrenci:** kulüp keşfi ve arama, anında katılım ya da notlu başvuru, başvuru durumu, kulüp akışı (gönderi, duyuru, anket, yorum, beğeni, kaydetme), etkinlik takvimi, kayıt / bekleme listesi, QR bilet, hatırlatıcılar, bildirim kutusu, profil, engelleme, şikâyet, destek talebi, hesap silme.
- **Kulüp yönetimi (başkan / yönetim kurulu):** panel ve grafikler, başvuru onay / ret (30 sn geri al), üye ve rol yönetimi, başkanlık devri, etkinlik oluşturma (kapak, kontenjan, görünürlük), yoklama (kamera ile QR ya da elle bilet kodu), içerik yönetimi, kulüp ayarları, faaliyet geçmişi.
- **Danışman:** yönetim panelini salt okunur görür.
- **Süper yönetici:** genel istatistikler, kulüp oluşturma / düzenleme / askıya alma, başkan ve danışman atama, şikâyet çözümü, kullanıcı askıya alma.

## Hızlı başlangıç (emülatörle, gerçek projeye dokunmadan)

Gerekenler: Node.js 20+, Java 17+ (Firebase emülatörü için), `npm i -g firebase-tools`.

```bash
npm install
npm run emulators          # Auth 9099 · Firestore 8080 · Storage 9199 (demo-gu-kulupler projesi)
npm run seed               # (ayrı terminal) demo verisini yükler: 226 kullanıcı, 14 kulüp, 22 etkinlik
npm run dev:emu            # http://localhost:5173
```

`npm run seed`, Flutter deposundaki `tool/seed/seed_emulator.js` betiğini kullanır. Depolar yan yana (`../gu_kulupler`) değilse yolu verin: `GU_SEED_SCRIPT=/yol/seed_emulator.js npm run seed`.

Demo hesaplarla giriş için `.env.emulator.local` dosyası oluşturun (git'e girmez):

```
VITE_DEMO_PASSWORD=<seed betiğindeki demo şifresi>
```

Giriş ekranında **Demo hesaplar** bölümü belirir: öğrenci (Ayşe), üye (Mehmet), yönetim kurulu (Elif), danışman (Zeynep), süper yönetici.

## Gerçek Firebase projesine bağlama

1. Firebase konsolu → **Proje ayarları → Uygulamalarınız → Web uygulaması ekle** (`gu-kulupler` projesi).
2. Verilen değerleri `.env.local` dosyasına yazın (`.env.example` şablondur):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_APP_ID=...
   ```
3. Authentication → Settings → **Authorized domains** listesine web adresini ekleyin.
4. `npm run build` → `dist/` klasörü herhangi bir statik barındırmaya (Firebase Hosting, Netlify, Vercel) yüklenebilir. `firebase.json` içinde Hosting ayarı (SPA yönlendirmesi, önbellek ve güvenlik başlıkları) hazırdır.

> ⚠️ **Güvenlik kuralları ve indeksler henüz yayına alınmadı.** `firebase/firestore.rules`, `firebase/storage.rules` ve `firebase/firestore.indexes.json` yalnızca emülatörde test edildi. Gerçek projeye yüklemeden önce Flutter deposundaki `firebase/` dosyalarıyla **birleştirilmeleri** gerekir (iki istemci aynı kuralları paylaşır). Yükleme komutu: `firebase deploy --only firestore:rules,firestore:indexes,storage --project gu-kulupler` — ekip onayı olmadan çalıştırmayın.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev:emu` | Emülatöre bağlı geliştirme sunucusu |
| `npm run dev` | Gerçek projeye bağlı geliştirme sunucusu (`.env.local` gerekir) |
| `npm run build` | Tür denetimi + üretim derlemesi (`dist/`) |
| `npm run typecheck` | Yalnız TypeScript denetimi |
| `npm test` | Birim testleri (Vitest) |
| `npm run test:rules` | Güvenlik kuralı testleri (136 test; emülatör açık olmalı) |
| `npm run e2e` | Uçtan uca tarayıcı testleri (21 senaryo; emülatör + `dev:emu` açık olmalı) |
| `npm run e2e -- --reset` | Önce emülatörü temizleyip demo verisini yeniden yükler |
| `npm run e2e -- --only=yönetim` | Adında "yönetim" geçen senaryolar |
| `npm run e2e -- --shots` | Taranan her ekranın görüntüsünü `e2e/out/screens/` altına kaydeder |
| `npm run seed` | Emülatörü temizler ve demo verisini yükler |

## Testler

**Güvenlik kuralı testleri** (`firebase/test/rules.test.mjs`) her rolün (öğrenci, üye, yönetim kurulu, başkan, danışman, süper yönetici, doğrulanmamış hesap, üniversite dışı e-posta) her koleksiyonda yapabildiklerini ve yapamadıklarını sınar: üyelik geçişleri (M1–M14), sayaçların yalnızca eşlik eden belgeyle ±1 değişmesi, beğeni / oy / yorum hileleri, kontenjan, yoklama zaman penceresi, günlük duyuru sınırı, bildirim yetkisi, dosya yükleme kuralları.

**Uçtan uca testler** (`e2e/run.mjs`) gerçek tarayıcıda, güvenlik kuralları açıkken çalışır:

- 5 rol × (telefon açık tema + masaüstü koyu tema) — rolün açabildiği tüm ekranlar; izin hatası, yakalanmamış hata, hata ekranı ya da yatay taşma olursa başarısız.
- Anında katıl → ayrıl → yeniden katıl (üye sayısı doğrulamalı)
- Notlu başvuru → notu düzenle → geri çek
- Beğen / geri al, kaydet, ankete oy, yorum (sayaçlar doğrulamalı)
- Etkinliğe katıl → bilet → etkinliklerim → ayrıl
- Başvuru onayla → 30 sn içinde geri al
- Gönderi paylaş → akışta gör → sil
- Bildirimli duyuru (günlük sayaç + üyelere bildirim dağıtımı)
- Etkinlik oluştur (tarih / saat / yer seçicileri) → yayınla + bildir → başka kullanıcı katılır → elle bilet kodu ile yoklama → aynı kod ikinci kez reddedilir
- Danışman salt okunur
- Süper yönetici: kullanıcı askıya al / kaldır, şikâyet kapat
- Yeni hesap: kayıt → e-posta doğrulama → profil kurulumu → kulübe katıl → hesabı sil (anonimleştirme doğrulamalı)

## Proje yapısı

```
src/
  app/        oturum, gezinme, veri önbelleği, eylemler, yükleyiciler
  data/       Firestore depoları (Flutter'daki *Repository sınıflarının karşılığı)
  screens/    ekranlar (AUT, CLB, FED, EVT, NTF, PRF, SET, MGT, ADM), sayfalar ve diyaloglar
  shell/      uygulama çerçevesi (sekme çubuğu / yan menü, bildirimler)
  ui/         tasarım sistemi bileşenleri
  i18n/       Türkçe / İngilizce metinler, Türkçe ek uyumu
  lib/        sabitler (Flutter Limits ile aynı), yardımcılar, ekip listesi
firebase/     güvenlik kuralları, indeksler, kural testleri
e2e/          uçtan uca testler
```

## Ekip

**Hakkında** ekranındaki ekip listesi `src/lib/team.ts` dosyasındadır; yeni üye eklemek için bir satır eklemek yeterlidir.

## Bilinen sınırlar ve kararlar

- Bildirimler istemciden dağıtılır (Cloud Functions yok); kural, gönderenin yetkisini doğrular. Alıcı listesi en çok 200 ilgi eşleşmesiyle sınırlıdır.
- Bekleme listesi sırasını hesaplayabilmek için `waitlist` durumundaki kayıtlar oturum açmış kullanıcılara okunabilir.
- Başvuru bildirimini yöneticilere iletebilmek için kulüplerin aktif başkan / yönetim kurulu üyelikleri okunabilir.
- Anket oyları kulüp üyelerine okunabilir (oy sayımı istemcide `count()` ile yapılır).
- Web'de arka plan (FCM) push bildirimi yoktur; bildirimler uygulama içi kutuda ve izin verilirse sekme açıkken tarayıcı bildirimi olarak görünür.
- Hard delete yoktur; tüm silmeler soft delete'tir (`isDeleted`).
