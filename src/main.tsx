import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import './styles/gu.css';
import './styles/web.css';
// ekran, sheet ve dialog kayıtları (yan etkiyle kayıt olur)
import './screens/dialogs';
// import './screens/sheets';
import './screens/screens-auth';
// import './screens/screens-clubs';
// import './screens/screens-events';
// import './screens/screens-manage';
// import './screens/screens-profile';
// import './screens/screens-admin';
import { Root } from './shell/Root';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
