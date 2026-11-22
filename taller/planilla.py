"""Planillas de Excel (.xlsx) sin dependencias externas.

Un .xlsx es un zip con unos pocos XML. Para lo que necesitamos (varias hojas,
encabezado en negrita, fechas y pesos con formato) alcanza con escribirlos a
mano, y así no sumamos una librería más al deploy.
"""
from __future__ import annotations

import io
import zipfile
from datetime import date, datetime
from decimal import Decimal
from typing import Iterable, Sequence
from xml.sax.saxutils import escape

# Estilos (índices en cellXfs): 0 normal, 1 encabezado, 2 fecha, 3 pesos, 4 título
NORMAL, ENCABEZADO, FECHA, PESOS, TITULO = range(5)

_EXCEL_EPOCH = date(1899, 12, 30)


def _columna(indice: int) -> str:
    letras = ""
    indice += 1
    while indice:
        indice, resto = divmod(indice - 1, 26)
        letras = chr(65 + resto) + letras
    return letras


def _celda(ref: str, valor, estilo: int | None) -> str:
    if valor is None or valor == "":
        return ""
    if isinstance(valor, datetime):
        valor = valor.date()
    if isinstance(valor, date):
        serial = (valor - _EXCEL_EPOCH).days
        return f'<c r="{ref}" s="{FECHA if estilo is None else estilo}"><v>{serial}</v></c>'
    if isinstance(valor, (int, float, Decimal)) and not isinstance(valor, bool):
        s = PESOS if estilo is None else estilo
        return f'<c r="{ref}" s="{s}"><v>{float(valor):.2f}</v></c>'
    texto = escape(str(valor)).replace("\n", "&#10;")
    s = NORMAL if estilo is None else estilo
    return f'<c r="{ref}" t="inlineStr" s="{s}"><is><t xml:space="preserve">{texto}</t></is></c>'


def _hoja(filas: Sequence[Sequence], anchos: Sequence[int] | None, encabezado: bool) -> str:
    cols = ""
    if anchos:
        cols = "<cols>" + "".join(f'<col min="{i + 1}" max="{i + 1}" width="{w}" customWidth="1"/>' for i, w in enumerate(anchos)) + "</cols>"
    vista = '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' if encabezado else ""
    cuerpo = []
    for r, fila in enumerate(filas, start=1):
        celdas = []
        for c, valor in enumerate(fila):
            estilo = None
            if isinstance(valor, tuple):  # (valor, estilo) para forzar un formato
                valor, estilo = valor
            elif encabezado and r == 1:
                estilo = ENCABEZADO
            celdas.append(_celda(f"{_columna(c)}{r}", valor, estilo))
        cuerpo.append(f'<row r="{r}">{"".join(celdas)}</row>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'{vista}{cols}<sheetData>{"".join(cuerpo)}</sheetData></worksheet>'
    )


_ESTILOS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/>'
    '<numFmt numFmtId="165" formatCode="&quot;$&quot; #,##0.00"/></numFmts>'
    '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font>'
    '<font><b/><sz val="11"/><name val="Calibri"/></font>'
    '<font><b/><sz val="14"/><name val="Calibri"/></font></fonts>'
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill></fills>'
    '<borders count="1"><border/></borders>'
    '<cellStyleXfs count="1"><xf/></cellStyleXfs>'
    '<cellXfs count="5">'
    '<xf/>'
    '<xf fontId="1" fillId="2" applyFont="1" applyFill="1"/>'
    '<xf numFmtId="164" applyNumberFormat="1"/>'
    '<xf numFmtId="165" applyNumberFormat="1"/>'
    '<xf fontId="2" applyFont="1"/>'
    '</cellXfs></styleSheet>'
)


def armar_xlsx(hojas: Iterable[dict]) -> bytes:
    """hojas: [{"nombre", "filas", "anchos"?, "encabezado"? (default True)}]"""
    hojas = list(hojas)
    salida = io.BytesIO()
    with zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            + "".join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1, len(hojas) + 1))
            + "</Types>"
        ))
        z.writestr("_rels/.rels", (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>"
        ))
        z.writestr("xl/workbook.xml", (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
            + "".join(f'<sheet name="{escape(h["nombre"][:31])}" sheetId="{i}" r:id="rId{i}"/>' for i, h in enumerate(hojas, start=1))
            + "</sheets></workbook>"
        ))
        z.writestr("xl/_rels/workbook.xml.rels", (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + "".join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1, len(hojas) + 1))
            + f'<Relationship Id="rId{len(hojas) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            "</Relationships>"
        ))
        z.writestr("xl/styles.xml", _ESTILOS)
        for i, h in enumerate(hojas, start=1):
            z.writestr(f"xl/worksheets/sheet{i}.xml", _hoja(h["filas"], h.get("anchos"), h.get("encabezado", True)))
    return salida.getvalue()
