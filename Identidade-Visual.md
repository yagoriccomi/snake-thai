# Guia de Identidade Visual e UI/UX – Snake Thai

Este documento serve como guia de referência técnica e de design para o desenvolvimento de aplicativos, sites, interfaces e materiais digitais da marca **Snake Thai**.

---

## 1. Visão Geral da Marca

* **Nome da Marca:** Snake Thai
* **Conceito Visual:** Dualidade, energia, tradição e força. O símbolo central é composto por duas serpentes entrelaçadas em formato circular, combinando a autenticidade artesanal com o impacto do contraste escuro e cores neon.
* **Tom de Voz Digital:** Moderno, marcante, dinâmico e direto.

---

## 2. Paleta de Cores (Cores para Interfaces)

As cores foram extraídas diretamente da marca e adaptadas para acessibilidade e uso em telas (UI/UX).

### Cores Primárias
* **Preto Profundo (Fundo / Background Dominante):**
  * `HEX:` `#0D0D0D` / `#121212`
  * `RGB:` `rgb(13, 13, 13)`
  * **Uso:** Fundo principal da interface (Dark Mode por padrão), cards escuros, headers e footers.

* **Verde Neon (Sotaque e Ação / Accent & CTA):**
  * `HEX:` `#39FF14` (ou `#22C55E` para variações de contraste)
  * `RGB:` `rgb(57, 255, 20)`
  * **Uso:** Botões principais (CTAs), destaques de status, elementos ativos, links com foco e ícones interativos.

* **Branco Puro (Texto e Contornos / Text & Borders):**
  * `HEX:` `#FFFFFF`
  * `RGB:` `rgb(255, 255, 255)`
  * **Uso:** Títulos principais, textos em fundos escuros, contornos de botões secundários (Outlined).

### Cores Secundárias e Neutras
* **Cinza Escuro (Superfícies e Elevação / Surface Layer):**
  * `HEX:` `#1E1E1E`
  * `RGB:` `rgb(30, 30, 30)`
  * **Uso:** Fundo de formulários, cards interativos, modais.

* **Cinza Médio (Textos Secundários e Bordas Muted):**
  * `HEX:` `#A1A1AA`
  * `RGB:` `rgb(161, 161, 170)`
  * **Uso:** Subtítulos, labels, bordas sutis de divisores.

* **Acentos Complementares (Inspirados na base do símbolo):**
  * **Azul Real:** `#1E3A8A`
  * **Vermelho Vibrante:** `#EF4444`
  * **Amarelo Quente:** `#F59E0B`
  * **Uso:** Tags de categorias, alertas, badget de status e detalhes visuais secundários.

---

## 3. Tipografia Recomendada para Digital

Como o logotipo utiliza uma fonte manuscrita e estilizada, a recomendação para interfaces (UI) é manter a legibilidade em telas sem perder o caráter forte da marca.

### Títulos e Destaques (Headings)
* **Estilo Recomendado:** Serif / Display marcante ou Sans-Serif Bold com traço orgânico.
* **Sugestões do Google Fonts:**
  * *Option A (Expressiva):* **Syne** ou **Cabinet Grotesk**
  * *Option B (Manuscrita / Accent para banners):* **Permanent Marker** ou **Caveat** (usar com moderação, apenas em frases curtas de impacto/hero sections).

### Texto de Corpo e Interface (Body & UI Elements)
* **Estilo:** Sans-Serif moderna, limpa e altamente legível.
* **Sugestões do Google Fonts:**
  * **Inter**
  * **Plus Jakarta Sans**
  * **Roboto**

---

## 4. Componentes e Diretrizes de UI (User Interface)

### Estilo Visual (Look & Feel)
* **Tema Padrão:** **Dark Mode First** (fundo escuro com elementos brilhantes/neon para destacar a essência da logo).
* **Bordas e Arredondamento:**
  * Cantos levemente arredondados (`border-radius: 8px` a `12px`) para simular uma estética moderna.
  * Uso de contornos finos em branco ou cinza (`border: 1px solid rgba(255, 255, 255, 0.15)`).

### Botões (Buttons)
* **Botão Primário (CTA):**
  * Fundo: Verde Neon (`#39FF14`)
  * Texto: Preto (`#0D0D0D` - Bold)
  * Hover: Glow sutil com `box-shadow: 0 0 15px rgba(57, 255, 20, 0.5)`
* **Botão Secundário:**
  * Fundo: Transparente
  * Borda: Branca (`1px solid #FFFFFF`)
  * Texto: Branco (`#FFFFFF`)

### Ícones e Ilustrações
* **Estilo dos Ícones:** Traço simples, outline branco ou verde neon.
* **Formas Geométricas:** Uso frequente de recipientes circulares (`border-radius: 50%`) para avatares, imagens de destaque e badges, fazendo eco à estrutura do logotipo.

---

## 5. Exemplo Prático de Código (CSS Variables)

```css
:root {
  /* Cores Principais */
  --bg-primary: #0d0d0d;
  --bg-surface: #1e1e1e;
  --accent-neon: #39ff14;
  --text-primary: #ffffff;
  --text-secondary: #a1a1aa;
  
  /* Cores de Detalhe */
  --accent-blue: #1e3a8a;
  --accent-red: #ef4444;
  --accent-yellow: #f59e0b;

  /* Tipografia */
  --font-heading: 'Syne', sans-serif;
  --font-body: 'Inter', sans-serif;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-body);
}

.btn-primary {
  background-color: var(--accent-neon);
  color: #0d0d0d;
  font-weight: bold;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  box-shadow: 0 0 15px rgba(57, 255, 20, 0.6);
}
```

---

## 6. Boas Práticas e Restrições

* **Sim:**
  * Manter alto contraste entre os textos e os fundos escuros.
  * Usar o verde neon estrategicamente em pontos focais de conversão/ação.
  * Usar fundo escuro para realçar a identidade gráfica.
* **Não:**
  * Não aplicar o verde neon como cor de fundo de parágrafos longos de texto.
  * Não alterar as proporções do logotipo das serpentes ao aplicá-lo nos apps/sites.
  * Evitar fundos totalmente brancos como padrão para a aplicação completa (prefira manter a estética *dark*).