import i18n from 'i18n';
const { configure } = i18n;
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

configure({
    locales: ['en', 'ar'],
    directory: path.join(dirname(fileURLToPath(import.meta.url)), 'local'),
    defaultLocale: 'ar',
    header: 'accept-language',
    autoReload: true,
    updateFiles: false,
    // api: {
    //     '__': '__', // ensures req.__ is the translation function
    // },
});

export default i18n;
