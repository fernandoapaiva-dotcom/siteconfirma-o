import PDFDocument from "pdfkit";

const GOLD = "#9a7a2f";
const SAGE = "#5f6e52";
const INK = "#3f3a2e";
const MUTED = "#7a7466";
const LINE = "#e6ded1";
const BG_ALT = "#fbfaf8";

/**
 * Normaliza e limpa o texto para fontes padrão do PDFKit (WinAnsi/Helvetica),
 * evitando emojis corrompidos (como Ø=Þ) e caracteres não renderizáveis.
 */
function sanitizeForPdf(text) {
  if (!text) return "";
  return String(text)
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, "") // Emojis modernos
    .replace(/[\u{2600}-\u{27BF}]/gu, "")   // Símbolos diversos e dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")   // Variações de seletores
    .replace(/[\u{E000}-\u{F8FF}]/gu, "")   // Área de uso privado
    .replace(/[\u2018\u2019]/g, "'")        // Aspas simples curvas
    .replace(/[\u201C\u201D]/g, '"')        // Aspas duplas curvas
    .replace(/[\u2013\u2014]/g, "-")        // Meia-risca e travessão
    .replace(/[\u2026]/g, "...")            // Reticências
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

/**
 * Extrai nomes dos acompanhantes salvos no padrão "3 (Nome 1, Nome 2, Nome 3)"
 */
function parseCompanions(acompanhantesStr) {
  if (!acompanhantesStr) return [];
  const match = String(acompanhantesStr).match(/\(([^)]+)\)/);
  if (match && match[1]) {
    return match[1]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
  }
  const count = parseInt(acompanhantesStr, 10) || 0;
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push(`Acompanhante ${i + 1}`);
  }
  return list;
}

/**
 * Monta o PDF da lista de confirmados e devolve como Buffer.
 * @param {Array} confirmacoes - lista vinda de listConfirmations()
 * @param {string} filtro - filtro de presença aplicado
 * @param {string} tituloCustomizado - se fornecido, ativa o modo "Lista Restaurante"
 */
export function buildGuestListPdf(confirmacoes, filtro, tituloCustomizado) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
      bufferPages: true,
    });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      // Adiciona numeração de página "Página X de Y" em todas as páginas
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .fillColor(MUTED)
          .text(
            `Página ${i + 1} de ${range.count}`,
            40,
            doc.page.height - 30,
            { align: "center", width: doc.page.width - 80 }
          );
      }
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    const isRestaurante = !!tituloCustomizado;

    // Filtra as confirmações
    const confirmacoesFiltradas = (confirmacoes || []).filter((c) => {
      if (!filtro || filtro === "Todos" || filtro === "todos") return true;
      if (filtro === "Vão ao Almoço") {
        return (
          c.presenca === "Cerimônia e Almoço" || c.presenca === "Apenas ao Almoço"
        );
      }
      if (filtro === "Vão à Cerimônia") {
        return (
          c.presenca === "Cerimônia e Almoço" ||
          c.presenca === "Apenas à Cerimônia"
        );
      }
      return c.presenca === filtro;
    });

    const totalPessoasFiltradas = confirmacoesFiltradas.reduce((soma, c) => {
      const acompCount = parseInt(c.acompanhantes, 10) || 0;
      return soma + 1 + acompCount;
    }, 0);

    const totalAlmoco = confirmacoes
      .filter(
        (c) =>
          c.presenca === "Cerimônia e Almoço" || c.presenca === "Apenas ao Almoço"
      )
      .reduce((soma, c) => {
        const acompCount = parseInt(c.acompanhantes, 10) || 0;
        return soma + 1 + acompCount;
      }, 0);

    const totalPessoas = confirmacoes
      .filter((c) => c.presenca !== "Não poderei comparecer")
      .reduce((soma, c) => {
        const acompCount = parseInt(c.acompanhantes, 10) || 0;
        return soma + 1 + acompCount;
      }, 0);

    const totalCerimonia = confirmacoes
      .filter(
        (c) =>
          c.presenca === "Cerimônia e Almoço" ||
          c.presenca === "Apenas à Cerimônia"
      )
      .reduce((soma, c) => {
        const acompCount = parseInt(c.acompanhantes, 10) || 0;
        return soma + 1 + acompCount;
      }, 0);

    const mainTitle = tituloCustomizado || "Batizado da Analu";
    const subTitle = isRestaurante
      ? "Relatório consolidado para reserva do almoço"
      : "Lista de convidados e confirmações de presença";

    // Definição de colunas da tabela (largura utilizável = 515)
    // Largura total da folha A4: 595. Margens: 40 + 40 = 80. Área: 515.
    const startX = 40;
    const tableWidth = 515;
    const bottomMargin = 50;

    let cols = [];
    if (isRestaurante) {
      // Para o Restaurante: apenas Nº e Nome do Convidado
      cols = [
        { key: "num", label: "Nº", width: 50, align: "center" },
        { key: "nome", label: "Nome do Convidado", width: 465, align: "left" },
      ];
    } else {
      // Para a Lista Geral em PDF: Nome, Acompanhantes, Presença e Mensagem bem diagramada
      cols = [
        { key: "nome", label: "Nome / Convidado(s)", width: 165, align: "left" },
        { key: "acomp", label: "Acomp.", width: 45, align: "center" },
        { key: "presenca", label: "Presença", width: 110, align: "left" },
        { key: "mensagem", label: "Mensagem para a Analu", width: 195, align: "left" },
      ];
    }

    function drawPageHeader() {
      doc
        .fillColor(GOLD)
        .fontSize(18)
        .text(mainTitle, 40, 40, { align: "center", width: tableWidth });

      doc
        .fillColor(SAGE)
        .fontSize(10.5)
        .text(subTitle, 40, doc.y + 2, { align: "center", width: tableWidth });

      doc.moveDown(0.3);

      const dataHoje = new Date().toLocaleDateString("pt-BR");
      let infoText = "";
      if (isRestaurante) {
        infoText = `Data: ${dataHoje}   ·   Quantidade Total Confirmada: ${totalAlmoco} pessoa(s)`;
      } else {
        infoText = `Data: ${dataHoje}   ·   ${totalPessoas} total geral   ·   ${totalCerimonia} na cerimônia   ·   ${totalAlmoco} no almoço`;
      }

      doc
        .fillColor(INK)
        .fontSize(9.5)
        .text(infoText, 40, doc.y, { align: "center", width: tableWidth });

      if (filtro && filtro !== "Todos" && !isRestaurante) {
        doc.moveDown(0.2);
        doc
          .fillColor(GOLD)
          .fontSize(9)
          .text(
            `Filtro aplicado: ${filtro} (${totalPessoasFiltradas} pessoa(s) exibida(s))`,
            40,
            doc.y,
            { align: "center", width: tableWidth }
          );
      }

      doc.moveDown(0.8);
    }

    function drawTableHeader(yPos) {
      // Fundo sutil do cabeçalho da tabela
      doc
        .rect(startX, yPos, tableWidth, 20)
        .fillColor("#f4efe6")
        .fill();

      let currX = startX;
      doc.fontSize(9).fillColor(GOLD);

      cols.forEach((c) => {
        doc.text(c.label, currX + 4, yPos + 5, {
          width: c.width - 8,
          align: c.align || "left",
        });
        currX += c.width;
      });

      // Linha divisória inferior do cabeçalho
      doc
        .moveTo(startX, yPos + 20)
        .lineTo(startX + tableWidth, yPos + 20)
        .strokeColor(GOLD)
        .lineWidth(1)
        .stroke();

      return yPos + 24;
    }

    // Desenha o cabeçalho inicial da primeira página
    drawPageHeader();
    let currentY = drawTableHeader(doc.y);

    if (confirmacoesFiltradas.length === 0) {
      doc
        .fontSize(10)
        .fillColor(INK)
        .text("Nenhuma confirmação encontrada com este filtro.", startX, currentY + 10);
      doc.end();
      return;
    }

    if (isRestaurante) {
      // ==========================================
      // RENDERIZAÇÃO DA LISTA PARA O RESTAURANTE
      // ==========================================
      let sequentialNumber = 1;
      let rowIndex = 0;

      confirmacoesFiltradas.forEach((c) => {
        const acompList = parseCompanions(c.acompanhantes);

        // Lista de pessoas deste grupo: titular + cada acompanhante
        const pessoasDoGrupo = [
          { nome: sanitizeForPdf(c.nome), isTitular: true },
          ...acompList.map((comp) => ({
            nome: sanitizeForPdf(comp),
            isTitular: false,
          })),
        ];

        pessoasDoGrupo.forEach((p) => {
          const numStr = String(sequentialNumber++);
          const nomeStr = p.isTitular ? p.nome : `   ${p.nome}`;

          const rowHeight = 19;
          const maxPageY = doc.page.height - bottomMargin;

          if (currentY + rowHeight > maxPageY) {
            doc.addPage();
            drawPageHeader();
            currentY = drawTableHeader(doc.y);
          }

          // Fundo alternado sutil para facilitar a leitura
          if (rowIndex % 2 === 1) {
            doc
              .rect(startX, currentY - 2, tableWidth, rowHeight)
              .fillColor(BG_ALT)
              .fill();
          }

          let currX = startX;
          doc.fontSize(9.5);

          // Coluna 1: Nº
          doc
            .fillColor(p.isTitular ? GOLD : MUTED)
            .text(numStr, currX + 4, currentY + 2, {
              width: cols[0].width - 8,
              align: cols[0].align,
            });
          currX += cols[0].width;

          // Coluna 2: Nome
          doc
            .fillColor(INK)
            .text(nomeStr, currX + 4, currentY + 2, {
              width: cols[1].width - 8,
              align: cols[1].align,
            });

          currentY += rowHeight;
          rowIndex++;
        });
      });

      // Linha de Total Geral ao final da tabela do restaurante
      const totalRowHeight = 26;
      if (currentY + totalRowHeight > doc.page.height - bottomMargin) {
        doc.addPage();
        drawPageHeader();
        currentY = drawTableHeader(doc.y);
      }

      currentY += 4;
      doc
        .rect(startX, currentY, tableWidth, 22)
        .fillColor("#f4efe6")
        .fill();

      doc
        .moveTo(startX, currentY)
        .lineTo(startX + tableWidth, currentY)
        .strokeColor(GOLD)
        .lineWidth(1)
        .stroke();

      doc
        .fontSize(10)
        .fillColor(GOLD)
        .text("TOTAL DE CONFIRMADOS:", startX + 10, currentY + 5, {
          width: 320,
          align: "right",
        });

      doc
        .fontSize(10)
        .fillColor(INK)
        .text(`${totalAlmoco} pessoas`, startX + 340, currentY + 5, {
          width: 160,
          align: "left",
        });
    } else {
      // ==========================================
      // RENDERIZAÇÃO DA LISTA GERAL EM PDF
      // ==========================================
      let sequentialNumber = 1;

      confirmacoesFiltradas.forEach((c, rowIndex) => {
        const acompList = parseCompanions(c.acompanhantes);
        const countOnly = parseInt(c.acompanhantes, 10) || 0;
        const mainNum = sequentialNumber++;

        // Monta o bloco de nomes: titular + acompanhantes recuados
        const nomeLines = [
          `${mainNum} - ${sanitizeForPdf(c.nome)}`,
          ...acompList.map((comp) => {
            const compNum = sequentialNumber++;
            return `     ${compNum} - ${sanitizeForPdf(comp)}`;
          }),
        ];
        const nomesText = nomeLines.join("\n");

        const acompText = countOnly > 0 ? String(countOnly) : "0";
        const presencaText = sanitizeForPdf(c.presenca || "");
        const mensagemText = sanitizeForPdf(c.mensagem || "");

        // Calcula a altura real necessária para cada coluna com quebra de linha
        doc.fontSize(9);
        const nomesHeight = doc.heightOfString(nomesText, {
          width: cols[0].width - 8,
          lineGap: 2,
        });
        const presencaHeight = doc.heightOfString(presencaText, {
          width: cols[2].width - 8,
        });
        const mensagemHeight = mensagemText
          ? doc.heightOfString(mensagemText, {
              width: cols[3].width - 8,
              lineGap: 2,
            })
          : 0;

        const rowHeight =
          Math.max(nomesHeight, presencaHeight, mensagemHeight, 18) + 8;
        const maxPageY = doc.page.height - bottomMargin;

        // Se não couber na página, cria nova página e repete o cabeçalho
        if (currentY + rowHeight > maxPageY) {
          doc.addPage();
          drawPageHeader();
          currentY = drawTableHeader(doc.y);
        }

        // Fundo alternado suave
        if (rowIndex % 2 === 1) {
          doc
            .rect(startX, currentY - 2, tableWidth, rowHeight)
            .fillColor(BG_ALT)
            .fill();
        }

        let currX = startX;

        // 1. Nome(s)
        doc
          .fontSize(9)
          .fillColor(INK)
          .text(nomesText, currX + 4, currentY + 3, {
            width: cols[0].width - 8,
            align: cols[0].align,
            lineGap: 2,
          });
        currX += cols[0].width;

        // 2. Acompanhantes
        doc
          .fontSize(9)
          .fillColor(MUTED)
          .text(acompText, currX + 4, currentY + 3, {
            width: cols[1].width - 8,
            align: cols[1].align,
          });
        currX += cols[1].width;

        // 3. Presença
        doc
          .fontSize(8.5)
          .fillColor(GOLD)
          .text(presencaText, currX + 4, currentY + 3, {
            width: cols[2].width - 8,
            align: cols[2].align,
          });
        currX += cols[2].width;

        // 4. Mensagem (sem sobreposição, ocupando a altura real necessária)
        if (mensagemText) {
          doc
            .fontSize(8.5)
            .fillColor(INK)
            .text(mensagemText, currX + 4, currentY + 3, {
              width: cols[3].width - 8,
              align: cols[3].align,
              lineGap: 2,
            });
        } else {
          doc
            .fontSize(8.5)
            .fillColor(MUTED)
            .text("-", currX + 4, currentY + 3, {
              width: cols[3].width - 8,
              align: "center",
            });
        }

        currentY += rowHeight;

        // Linha divisória suave entre cada grupo de convidados
        doc
          .moveTo(startX, currentY - 2)
          .lineTo(startX + tableWidth, currentY - 2)
          .strokeColor(LINE)
          .lineWidth(0.5)
          .stroke();
      });
    }

    doc.end();
  });
}
