/* Emülatör demo hesapları — yalnızca VITE_USE_EMULATOR=true ve VITE_DEMO_PASSWORD tanımlıyken giriş ekranında gösterilir. */
import { USE_EMULATOR } from './firebase';
export const DEMO_PASSWORD: string = (import.meta.env.VITE_DEMO_PASSWORD as string) || '';
export const DEMO_ENABLED = USE_EMULATOR && !!DEMO_PASSWORD;
export const DEMO_ACCOUNTS = [
  { id: 'u_ayse', name: 'Ayşe Demir', email: 'ayse.demir@ogr.gumushane.edu.tr', roleKey: 'role.student', descKey: 'panel.acc.ayse' },
  { id: 'u_mehmet', name: 'Mehmet Kaya', email: 'mehmet.kaya@ogr.gumushane.edu.tr', roleKey: 'role.member', descKey: 'panel.acc.mehmet' },
  { id: 'u_elif', name: 'Elif Yıldız', email: 'elif.yildiz@ogr.gumushane.edu.tr', roleKey: 'role.board', descKey: 'panel.acc.elif' },
  { id: 'u_burak', name: 'Burak Şahin', email: 'burak.sahin@ogr.gumushane.edu.tr', roleKey: 'role.president', descKey: 'panel.acc.burak' },
  { id: 'u_zeynep', name: 'Dr. Öğr. Üyesi Zeynep Arslan', email: 'zeynep.arslan@gumushane.edu.tr', roleKey: 'role.advisor', descKey: 'panel.acc.zeynep' },
  { id: 'u_admin', name: 'Kampüs Yönetimi', email: 'admin@gumushane.edu.tr', roleKey: 'role.superadmin', descKey: 'panel.acc.admin' },
];
