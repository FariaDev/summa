// Entrada da página: escolhe os textos pelo lang do <html> e liga as partes.
import {createInk} from './ink.js';
import {createPicker} from './picker.js';
import {createDemo} from './demo.js';
import {initTools} from './tools.js';
import {initPrefs} from './prefs.js';
import {initPage} from './page.js';

const lang = document.documentElement.lang.startsWith('en') ? 'en' : 'pt';
const {default: content} = await import(`./content-${lang}.js`);

initPrefs(content.text);
const ink = createInk();
const picker = createPicker(content.picker);
const demo = createDemo(content, ink, picker);
initTools(content, demo);
initPage(content.text, demo);
