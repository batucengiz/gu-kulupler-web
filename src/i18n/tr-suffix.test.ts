import { describe, expect, it } from 'vitest';
import { trSuffix } from './tr-suffix';

describe('trSuffix', () => {
  it.each([
    ['Berk Çelik', 'ın', 'in'], ['Serkan Ünal', 'ın', 'ın'], ['Ayşe Demir', 'ın', 'in'], ['Elif Yıldız', 'ın', 'ın'],
    ['Ali Koç', 'ın', 'un'], ['Ayşe', 'ın', 'nin'], ['Doğu Kurt', 'ın', 'un'], ['Gül Öztürk', 'ın', 'ün'], ['Burak Şahin', 'ın', 'in'],
  ])('tamlayan: %s + %s → %s', (v, s, e) => expect(trSuffix(v, s)).toBe(e));
  it.each([
    ['Eylül 2026', 'den', 'dan'], ['Ekim 2020', 'den', 'den'], ['Mart 2023', 'den', 'ten'], ['Mayıs 2024', 'den', 'ten'],
    ['Ocak 2025', 'den', 'ten'], ['Kasım 2030', 'den', 'dan'], ['Mart 2040', 'den', 'tan'], ['Şubat 2000', 'den', 'den'], ['Eylül 2010', 'den', 'dan'],
    ['Haziran 2027', 'den', 'den'], ['Nisan 2029', 'den', 'dan'],
  ])('ayrılma: %s + %s → %s', (v, s, e) => expect(trSuffix(v, s)).toBe(e));
  it('bulunma ve yönelme', () => {
    expect(trSuffix('Kütüphane', 'de')).toBe('de');
    expect(trSuffix('Spor Salonu', 'de')).toBe('da');
    expect(trSuffix('Konferans', 'de')).toBe('ta');
    expect(trSuffix('Ayşe', 'a')).toBe('ye');
    expect(trSuffix('Burak', 'e')).toBe('a');
  });
  it('tanınmayan ek değişmez', () => expect(trSuffix('Ali', 'lar')).toBe('lar'));
});
