import PDFDocument from "pdfkit";

const GOLD = "#9a7a2f";
const SAGE = "#5f6e52";
const INK = "#3f3a2e";

/**
 * Monta o PDF da lista de confirmados e devolve como Buffer.
 * @param {Array} confirmacoes - lista vinda de listConfirmations()
 */
function parseCompanions(acompanhantesStr) {
  if (!acompanhantesStr) return [];
  const match = String(acompanhantesStr).match(/\(([^)]+)\)/);
  if (match && match[1]) {
    return match[1].split(",").map(name => name.trim()).filter(Boolean);
  }
  const count = parseInt(acompanhantesStr, 10) || 0;
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push(`Acompanhante ${i + 1}`);
  }
  return list;
}

export function buildGuestListPdf(confirmacoes, filtro, tituloCustomizado) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const confirmacoesFiltradas = (confirmacoes || []).filter((c) => {
      if (!filtro || filtro === "Todos" || filtro === "todos") return true;
      if (filtro === "Vão ao Almoço") {
        return c.presenca === "Cerimônia e Almoço" || c.presenca === "Apenas ao Almoço";
      }
      if (filtro === "Vão à Cerimônia") {
        return c.presenca === "Cerimônia e Almoço" || c.presenca === "Apenas à Cerimônia";
      }
      return c.presenca === filtro;
    });

    const totalPessoasFiltradas = confirmacoesFiltradas.reduce((soma, c) => {
      const acompCount = parseInt(c.acompanhantes, 10) || 0;
      return soma + 1 + acompCount;
    }, 0);

    const totalPessoas = confirmacoes
      .filter((c) => c.presenca !== "Não poderei comparecer")
      .reduce((soma, c) => {
        const acompCount = parseInt(c.acompanhantes, 10) || 0;
        return soma + 1 + acompCount;
      }, 0);

    const totalAlmoco = confirmacoes
      .filter((c) => c.presenca === "Cerimônia e Almoço" || c.presenca === "Apenas ao Almoço")
      .reduce((soma, c) => {
        const acompCount = parseInt(c.acompanhantes, 10) || 0;
        return soma + 1 + acompCount;
      }, 0);

    const totalCerimonia = confirmacoes
      .filter((c) => c.presenca === "Cerimônia e Almoço" || c.presenca === "Apenas à Cerimônia")
      .reduce((soma, c) => {
        const acompCount = parseInt(c.acompanhantes, 10) || 0;
        return soma + 1 + acompCount;
      }, 0);

    const mainTitle = tituloCustomizado || "Batizado da Analu";
    const subTitle = tituloCustomizado 
      ? "Relatório consolidado para reserva do almoço" 
      : "Lista de convidados e confirmações de presença";

    doc
      .fillColor(GOLD)
      .fontSize(20)
      .text(mainTitle, { align: "center" });
    doc
      .fillColor(SAGE)
      .fontSize(11)
      .text(subTitle, { align: "center" });

    if (filtro && filtro !== "Todos") {
      doc.moveDown(0.2);
      doc
        .fillColor(GOLD)
        .fontSize(10)
        .text(`Filtro aplicado: ${filtro} (${totalPessoasFiltradas} pessoa(s) exibida(s))`, { align: "center" });
    }

    const isRestaurante = !!tituloCustomizado;

    doc.moveDown(0.5);
    doc
      .fillColor(INK)
      .fontSize(10);

    if (isRestaurante) {
      doc.text(
        `Gerado em ${new Date().toLocaleDateString("pt-BR")} · Total Confirmados para o Almoço: ${totalAlmoco} pessoa(s)`,
        { align: "center" }
      );
    } else {
      doc.text(
        `Gerado em ${new Date().toLocaleDateString("pt-BR")} · ${totalPessoas} total geral · ${totalCerimonia} na cerimônia · ${totalAlmoco} no almoço`,
        { align: "center" }
      );
    }

    doc.moveDown(1.2);

    // Cabeçalho da tabela
    const startX = doc.x;
    let y = doc.y;
    const cols = isRestaurante
      ? [
          { label: "Nome", width: 230 },
          { label: "Acomp.", width: 60 },
          { label: "Mensagem", width: 210 },
        ]
      : [
          { label: "Nome", width: 150 },
          { label: "Acomp.", width: 50 },
          { label: "Presença", width: 110 },
          { label: "Mensagem", width: 190 },
        ];

    function drawRow(values, opts = {}) {
      let x = startX;
      doc.fontSize(9.5).fillColor(opts.header ? GOLD : INK);
      values.forEach((val, i) => {
        doc.text(String(val ?? ""), x, y, { width: cols[i].width, ellipsis: true });
        x += cols[i].width;
      });
      y += 18;
      if (y > 760) {
        doc.addPage();
        y = 40;
      }
    }

    drawRow(cols.map((c) => c.label), { header: true });
    doc
      .moveTo(startX, y - 4)
      .lineTo(startX + cols.reduce((s, c) => s + c.width, 0), y - 4)
      .strokeColor(SAGE)
      .stroke();

    let sequentialNumber = 1;

    if (confirmacoesFiltradas.length === 0) {
      doc.fontSize(10).fillColor(INK).text("Nenhuma confirmação com este filtro.", startX, y);
    }

    confirmacoesFiltradas.forEach((c) => {
      const acompList = parseCompanions(c.acompanhantes);
      const mainGuestNumber = sequentialNumber++;
      const countOnly = parseInt(c.acompanhantes, 10) || 0;

      if (isRestaurante) {
        // Imprime convidado principal
        drawRow([
          `${mainGuestNumber} - ${c.nome}`,
          countOnly > 0 ? String(countOnly) : "0",
          c.mensagem
        ]);

        // Imprime acompanhantes recuados
        acompList.forEach((compName) => {
          const compNumber = sequentialNumber++;
          drawRow([
            `      ${compNumber} - ${compName}`,
            "",
            ""
          ]);
        });
      } else {
        // Imprime convidado principal
        drawRow([
          `${mainGuestNumber} - ${c.nome}`,
          countOnly > 0 ? String(countOnly) : "0",
          c.presenca,
          c.mensagem
        ]);

        // Imprime acompanhantes recuados
        acompList.forEach((compName) => {
          const compNumber = sequentialNumber++;
          drawRow([
            `      ${compNumber} - ${compName}`,
            "",
            "",
            ""
          ]);
        });
      }
    });

    doc.end();
  });
}
