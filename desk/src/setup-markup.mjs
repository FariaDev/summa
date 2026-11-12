// @ts-check
/* A marcação da primeira abertura em tela cheia (#64). Mora aqui, e não no
   index.html, porque o index.html tem teto de linhas que só cai
   (tests/file-size.test.mjs). O `main.mjs` monta isto antes do primeiro
   `setUiLanguage`, então os `data-i18n` são traduzidos como o resto do HTML
   estático; a pintura do que muda é do `setup-view.mjs`. */

import {SCENE_SVG} from './setup-scene.mjs';

const SETUP_MARKUP = `
  <div class="setup-bar">
    <span class="setup-brand"><img class="brand-icon" src="assets/app-icon/integral-light-graphite-128.png" alt="">Summa</span>
    <nav class="setup-bar-actions" aria-label="Idioma e ajuda" data-i18n-attr="aria-label=setup.barAria">
      <!-- Idioma (#41): "Português · English", nos dois idiomas de propósito — quem não lê o idioma de agora ainda acha o seu. -->
      <div id="first-run-language" class="first-run-language" role="group" aria-label="Idioma / Language"><button type="button" data-language="pt-BR" aria-pressed="true">Português</button><span aria-hidden="true">·</span><button type="button" data-language="en" aria-pressed="false">English</button></div>
      <span class="setup-bar-sep" aria-hidden="true"></span>
      <button type="button" id="setup-free" class="setup-quiet" title="Abre a aba Livre, sem criar matéria agora" data-i18n="setup.free" data-i18n-attr="title=setup.freeTitle">Estudar sem matéria</button>
      <button type="button" id="first-run-help" class="first-run-help" data-i18n="firstrun.helpLabel">Como a Mesa funciona</button>
    </nav>
  </div>
  <div class="setup-stage" id="setup-stage">
    <div class="setup-scene-column">
      <div class="setup-scene" id="setup-scene" data-scene="welcome" aria-hidden="true">${SCENE_SVG}</div>
      <p class="setup-speech" id="setup-speech" aria-live="polite"></p>
    </div>
    <section class="setup-card" id="setup-card">
      <ol class="setup-trail" id="setup-trail" aria-label="Passos" data-i18n-attr="aria-label=setup.trailAria"></ol>

      <div class="setup-step" data-step="welcome">
        <h1 data-i18n="setup.welcome.title">Boas-vindas à Summa.</h1>
        <div class="setup-language">
          <span class="setup-label" data-i18n="setup.language.title">Idioma da Mesa</span>
          <div id="setup-language" role="radiogroup" aria-label="Idioma / Language">
            <button type="button" role="radio" data-language="pt-BR" aria-checked="true"><strong>Português</strong><span data-i18n="setup.language.ptNote">do Brasil</span></button>
            <button type="button" role="radio" data-language="en" aria-checked="false"><strong>English</strong><span data-i18n="setup.language.enNote">dá para trocar depois</span></button>
          </div>
        </div>
        <!-- Cor de acento (#70): vale na hora, como nas Configurações. -->
        <div class="setup-accent" role="radiogroup" aria-label="Cor de acento" data-i18n-attr="aria-label=settings.accent" id="setup-accent">
          <span class="setup-label" data-i18n="settings.accent">Cor de acento</span>
          <div class="accent-options"></div>
        </div>
      </div>

      <div class="setup-step" data-step="tour">
        <div class="setup-tour-head"><span class="setup-tour-num" id="setup-tour-num">1</span><h1 id="setup-tour-title"></h1></div>
        <p class="setup-tour-text" id="setup-tour-text"></p>
      </div>

      <div class="setup-step" data-step="name">
        <h1 data-i18n="setup.name.title">Dê um nome à matéria.</h1>
        <p class="setup-lead setup-lead-sm" data-i18n="setup.name.lead">Cada matéria é uma aba no topo da Mesa, com os PDFs, as sessões com o tutor e o caderno de revisão dela. Dá para criar outras depois, com ⌘ T.</p>
        <label for="first-run-name" class="setup-label" data-i18n="firstrun.nameLabel">Nome da matéria</label>
        <input id="first-run-name" type="text" maxlength="120" autocomplete="off" spellcheck="false" placeholder="Nome da matéria, ex.: Cálculo I" data-i18n-attr="placeholder=firstrun.namePlaceholder">
        <div class="setup-examples" id="setup-examples">
          <span data-i18n="setup.name.examples">Exemplos:</span>
          <button type="button" data-i18n="setup.name.example1">Cálculo I</button>
          <button type="button" data-i18n="setup.name.example2">Física II</button>
          <button type="button" data-i18n="setup.name.example3">Álgebra Linear</button>
          <button type="button" data-i18n="setup.name.example4">Química Geral</button>
        </div>
      </div>

      <div class="setup-step" data-step="folder">
        <h1 id="setup-folder-title"></h1>
        <p class="setup-lead setup-lead-sm" data-i18n="setup.folder.lead">Diga onde estão os PDFs dela, ou arraste os arquivos para o quadro abaixo. Vale soltar em qualquer ponto desta tela. A Mesa abre os arquivos de onde eles estão, sem copiar.</p>
        <button type="button" id="first-run-pick" class="setup-drop">
          <span class="setup-drop-icon" data-icon="download" aria-hidden="true"></span>
          <strong id="setup-drop-title"></strong>
          <small id="setup-drop-help"></small>
        </button>
        <div class="setup-chosen" id="setup-chosen" hidden>
          <span id="setup-chosen-folder"></span>
          <small id="setup-chosen-files"></small>
          <button type="button" id="setup-folder-remove" class="setup-link setup-folder-remove" data-i18n="setup.folder.remove">Tirar esta pasta</button>
        </div>
        <p class="setup-elsewhere" id="setup-elsewhere" role="status" hidden></p>
      </div>

      <div class="setup-step" data-step="tutor">
        <h1 id="setup-tutor-title"></h1>
        <p class="setup-lead setup-lead-sm" id="setup-tutor-text"></p>
        <button type="button" class="setup-link" data-open-guide="tutor" data-i18n="guide.howItWorks">Como funciona</button>
        <div class="setup-tutor-off" id="setup-tutor-off">
          <span class="setup-pi" id="setup-pi"></span>
          <div class="setup-tutor-actions" id="setup-tutor-actions"></div>
          <div class="setup-providers" id="setup-providers"></div>
        </div>
        <p class="setup-note setup-login" id="setup-login-hint" hidden></p>
      </div>

      <div class="setup-step" data-step="ready">
        <h1 id="setup-ready-title"></h1>
        <dl class="setup-summary" id="setup-summary"></dl>
        <p class="setup-note setup-login" id="setup-ready-login" hidden></p>
        <button type="button" class="setup-link" data-open-guide="atalhos" data-i18n="guide.howItWorks">Como funciona</button>
      </div>

      <div class="setup-foot">
        <button type="button" id="setup-back" data-i18n="setup.back">Voltar</button>
        <div class="setup-dots" id="setup-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <span class="setup-hint" id="setup-hint"></span>
        <button type="button" id="setup-skip-tour" class="setup-quiet" data-i18n="setup.skipTour">Pular a explicação</button>
        <button type="button" id="setup-next" class="primary"></button>
      </div>
    </section>
  </div>
`;

/**
 * Põe os passos dentro de `#setup` (a casca vazia do index.html). Idempotente.
 * @param {Document} [doc]
 * @example mountSetupMarkup() // #setup ganha a barra, o palco do trio e o cartão
 */
export function mountSetupMarkup(doc = document) {
  const setup = doc.querySelector('#setup');
  if (!setup || setup.childElementCount) return;
  setup.innerHTML = SETUP_MARKUP;
}
