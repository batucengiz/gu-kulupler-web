# Web sitesini yayına alma

Web uygulaması Flutter uygulamasıyla aynı Firebase projesini (`gu-kulupler`) kullanır. Kod hazırdır ve emülatörde tam test edilmiştir. Yayına almak için aşağıdaki üç adım gerekir. Üçü de Firebase konsoluna erişimi olan kişinin (Flutter tarafı) işidir.

## 1. Firebase'e web uygulaması ekle

Firebase konsolu → Proje ayarları → Uygulamalarınız → **Web uygulaması ekle**. Çıkan `apiKey` ve `appId` değerlerini depo kökündeki `.env.production.local` dosyasına yazın (bu dosya git'e girmez):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_APP_ID=...
```

Diğer değerler `.env.example` içinde hazırdır. Authentication → Settings → **Authorized domains** listesine sitenin alan adını ekleyin (Firebase Hosting kullanılırsa `gu-kulupler.web.app` zaten listededir).

## 2. Kuralları birleştir

`firebase/firestore.rules` ve `firebase/storage.rules`, Flutter deposundaki T-29 kurallarının **birebir kopyasıdır**. Üzerine yalnızca `WEB-EK` işaretli dallar eklenmiştir. Bu dallar Flutter'da henüz yazılmamış yönetim (T-30) ve süper admin (T-37) yazımlarını açar:

- **Yönetici üyelik geçişleri:** M5 onay, M6 red, M9 çıkarma, M10 rol, M11 devir, M12 geri alma (30 sn).
  - `memberCount` işaretçisi herkese açık kulüp belgesine yazılmaz. İşaretçi `clubs/{clubId}/private/counter` yan belgesindedir, etkinliklerdeki `events/{id}/private/counter` deseniyle aynı.
- **Kulüp ayarları (MGT-07):** ayarlar, `settings_changed` günlüğü ve `clubs/` Storage yüklemesi.
- **Süper admin kulüp işlemleri:**
  - Kulüp oluşturma (başkan üyeliği ve iletişim belgesi aynı batch'te).
  - Kimlik ve askı.
  - Başkan ataması (M11) ve danışman ataması (M13).
- **Kullanıcı askısı:** `users.status` ve `private/account.suspendReason` aynı batch'te yazılır (CD-133).
- **Şikayet çözümü (ADM-04)** ve `report_resolved` bildirimi.
- **Yönetim bildirimleri:** `application_approved`, `application_rejected`, `removed_from_club`, `role_changed`.
  - Kimlik olay başına rastgele 20 karakterlik anahtardır.
  - Bildirim yalnızca hedef üyelik aynı işlemde o duruma geçtiyse yazılabilir.
- **Yönetim günlükleri:** `{clubId}_{uid}_{kind}_{20 karakter}` kimlikli, olaya bağlı.
- **Süper admin e-posta araması (ADM-05):** `collectionGroup('private')`, yalnızca `emailLower` taşıyan belgeler.

Mevcut hiçbir Flutter dalı değiştirilmedi. Flutter deposunun kural testleri bu dosyalara karşı çalıştırıldı: **4280 / 4299 geçti**. Kalan 17'si yalnızca "T-30 / T-37'de açılır" türü beklentiler ile match bloğu ve tür sayısı denetimleridir. Bunlar o task'larda zaten güncellenecek beklentilerdir.

`firebase/firestore.indexes.json` iki deponun indekslerinin birleşimidir (Flutter'ın 23 indeksi ve web'in eklediği 4 indeks).

**Önerilen yol:** Flutter ekibi bu dosyaları kendi `firebase/` klasörüne alır (ya da T-30 / T-37'yi yazarken bu dalları temel alır), beklenti dosyalarını günceller ve tek kaynaktan yükler:

```
firebase deploy --only firestore:rules,firestore:indexes,storage --project gu-kulupler
```

> ⚠️ **Kuralları güncellerken `WEB-EK` bölümlerini koruyun.** Flutter `firebase/firestore.rules` / `storage.rules` dosyalarını güncellerken bu depodaki `WEB-EK` işaretli bölümleri silmeyin ya da değiştirmeyin; web'in yönetim ve admin ekranları bunlara dayanır. Bulmak için: `grep -n "WEB-EK" firebase/*.rules`. Eklenen fonksiyonlar ve `allow` satırlarına eklenen `||` dalları: kulüp (`canBumpManagedMemberCount`, `canEditSettings`, `canTransferPresidency`, `canAdminClub`, `canCreateClub`, `clubs/{id}/private/counter` bloğu), üyelik (`canApprove` … `canDropAdvisorAsSuper`, `canCreateAsSuper`, `canCreateContactAsSuper`), kullanıcı (`canSetStatusAsSuper`, `canSetSuspendReason`), bildirim (`mgmtKindOk`), şikayet (`canResolveReport`), günlük (`canLogManagement`, `canLogSettings`), `collectionGroup('private')` listesi ve Storage `clubs/` yüklemesi. T-30 / T-37 bu işlemleri farklı biçimde tanımlarsa web veri katmanı da aynı commit'te güncellenmelidir — değişikliği yüklemeden önce web'in `npm run e2e -- --reset` ve `npm run test:rules` komutlarıyla deneyin.
>
> Web deposundan kural yüklemek Flutter kurallarının üzerine yazar. Bu yüzden yüklemeyi iki ekip anlaştıktan sonra **tek bir yerden** yapın.

## 3. Siteyi yayınla

```
npm ci
npm run build          # dist/ klasörü oluşur
firebase deploy --only hosting --project gu-kulupler
```

`firebase.json` içinde Hosting ayarları hazırdır: SPA yönlendirmesi, önbellek ve güvenlik başlıkları. `dist/` istenirse Netlify veya Vercel gibi başka bir statik barındırmaya da yüklenebilir.

## Testler (yayından önce)

| Komut | Sonuç (14 Ekim 2026) |
|---|---|
| `npx tsc --noEmit` | hatasız |
| `npm test` | 22 / 22 |
| `npm run test:rules` (emülatör + `npm run seed`) | 45 / 45 |
| `npm run e2e -- --reset` | 21 / 21 senaryo (birleşik kurallarla) |
| Flutter `firebase/` testleri, bu kurallarla | 4280 / 4299 (fark yukarıda) |

## Flutter ekibine not: seed betiği

`tool/seed/seed_emulator.js` güncel Auth emülatöründe (firebase-tools 14.27) `u_deleted` kullanıcısında durur ("displayName must be string"), çünkü `displayName: null` gönderiliyor. `tool/lib/emulator_rest.js` içinde `displayName: user.displayName ?? undefined` yapılınca düzeliyor. Web testleri bu düzeltmeyi içeren yerel bir kopyayla çalıştırıldı (`GU_SEED_SCRIPT` ortam değişkeni).
