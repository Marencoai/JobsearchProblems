#!/usr/bin/env python3
"""Prototype resume renderer: professional-two-page-v1.

Two-page, single-column ATS-friendly resume layout designed for stable visual
consistency across different job families and content densities.

Content selection and page budgeting happen upstream. This renderer owns
presentation only and must not invent or rewrite candidate facts.
"""
import json, argparse
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

NAVY='17324D'
BLUE='4C7194'
TEXT='2F3A45'
MUTED='5C6670'
RULE='8EA9BF'
FONT='Arial'

def set_run(run, size, bold=False, color=TEXT, italic=False):
    run.font.name=FONT
    run.font.size=Pt(size)
    run.font.bold=bold
    run.font.italic=italic
    run.font.color.rgb=RGBColor.from_string(color)

def set_cell_margins(cell, top=80,start=100,bottom=80,end=100):
    tcPr=cell._tc.get_or_add_tcPr()
    tcMar=tcPr.first_child_found_in('w:tcMar')
    if tcMar is None:
        tcMar=OxmlElement('w:tcMar')
        tcPr.append(tcMar)
    for m,v in [('top',top),('start',start),('bottom',bottom),('end',end)]:
        node=tcMar.find(qn('w:'+m))
        if node is None:
            node=OxmlElement('w:'+m)
            tcMar.append(node)
        node.set(qn('w:w'),str(v))
        node.set(qn('w:type'),'dxa')

def no_borders(table):
    borders=OxmlElement('w:tblBorders')
    for edge in ('top','left','bottom','right','insideH','insideV'):
        el=OxmlElement('w:'+edge)
        el.set(qn('w:val'),'nil')
        borders.append(el)
    table._tbl.tblPr.append(borders)

def add_bottom_rule(p,color=RULE,sz='7'):
    pBdr=OxmlElement('w:pBdr')
    bottom=OxmlElement('w:bottom')
    bottom.set(qn('w:val'),'single')
    bottom.set(qn('w:sz'),sz)
    bottom.set(qn('w:space'),'2')
    bottom.set(qn('w:color'),color)
    pBdr.append(bottom)
    p._p.get_or_add_pPr().append(pBdr)

def section_heading(doc,text):
    p=doc.add_paragraph()
    p.paragraph_format.space_before=Pt(6)
    p.paragraph_format.space_after=Pt(4)
    set_run(p.add_run(text.upper()),10.5,True,NAVY)
    add_bottom_rule(p)

def add_header(doc,data,compact=False):
    if compact:
        p=doc.add_paragraph()
        p.paragraph_format.space_after=Pt(1)
        set_run(p.add_run(data['name']),14.5,True,NAVY)
        set_run(p.add_run('  |  '+data['headline']),8.3,False,MUTED)
        p=doc.add_paragraph()
        p.paragraph_format.space_after=Pt(4)
        set_run(p.add_run(data['contact_line']),7.8,False,MUTED)
        add_bottom_rule(p,BLUE,'6')
        return
    p=doc.add_paragraph()
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after=Pt(0)
    set_run(p.add_run(data['name']),27,True,NAVY)
    p=doc.add_paragraph()
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after=Pt(1)
    set_run(p.add_run(data['headline']),10,True,BLUE)
    p=doc.add_paragraph()
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after=Pt(6)
    set_run(p.add_run(data['contact_line']),8,False,MUTED)
    add_bottom_rule(p,BLUE,'7')

def add_summary(doc,text):
    section_heading(doc,'Professional Summary')
    p=doc.add_paragraph()
    p.paragraph_format.space_after=Pt(4)
    p.paragraph_format.line_spacing=1.08
    set_run(p.add_run(text),9.75,False,TEXT)

def add_capabilities(doc,skills):
    section_heading(doc,'Core Capabilities')
    for row in [skills[i:i+4] for i in range(0,len(skills),4)]:
        p=doc.add_paragraph()
        p.paragraph_format.space_after=Pt(1.5)
        for i,skill in enumerate(row):
            if i:
                set_run(p.add_run('  |  '),8.5,False,RULE)
            set_run(p.add_run(skill),8.9,i==0,TEXT)

def add_role(doc,role,compact=False):
    p=doc.add_paragraph()
    p.paragraph_format.space_before=Pt(5 if not compact else 3.5)
    p.paragraph_format.space_after=Pt(1.5)
    p.paragraph_format.keep_with_next=True
    p.paragraph_format.tab_stops.add_tab_stop(Inches(6.85),WD_TAB_ALIGNMENT.RIGHT)
    set_run(p.add_run(role['title']),9.75,True,NAVY)
    if role.get('company'):
        set_run(p.add_run('  |  '+role['company']),9.2,False,TEXT)
    set_run(p.add_run('\t'+role['dates']),8.7,False,MUTED)
    for b in role.get('bullets',[]):
        bp=doc.add_paragraph()
        bp.paragraph_format.left_indent=Inches(.18)
        bp.paragraph_format.first_line_indent=Inches(-.12)
        bp.paragraph_format.space_after=Pt(1.9)
        bp.paragraph_format.line_spacing=1.03
        bp.paragraph_format.keep_together=True
        set_run(bp.add_run('• '),8.45,True,BLUE)
        set_run(bp.add_run(b),9.0,False,TEXT)

def add_impact(doc,impacts):
    section_heading(doc,'Selected Impact')
    table=doc.add_table(rows=0,cols=2)
    table.autofit=False
    no_borders(table)
    table.columns[0].width=Inches(3.6)
    table.columns[1].width=Inches(3.6)
    for i in range(0,len(impacts),2):
        row=table.add_row().cells
        for j in range(2):
            if i+j < len(impacts):
                set_cell_margins(row[j],55,70,55,90)
                p=row[j].paragraphs[0]
                set_run(p.add_run('• '),8.5,True,BLUE)
                set_run(p.add_run(impacts[i+j]),8.75,False,TEXT)

def add_projects(doc,projects):
    if not projects:
        return
    section_heading(doc,'Selected Projects & Systems')
    for pr in projects:
        p=doc.add_paragraph()
        p.paragraph_format.space_before=Pt(3)
        p.paragraph_format.space_after=Pt(1)
        set_run(p.add_run(pr['name']),9.3,True,NAVY)
        if pr.get('role'):
            set_run(p.add_run('  |  '+pr['role']),8.8,False,MUTED)
        for b in pr.get('bullets',[]):
            bp=doc.add_paragraph()
            bp.paragraph_format.left_indent=Inches(.18)
            bp.paragraph_format.first_line_indent=Inches(-.12)
            bp.paragraph_format.space_after=Pt(1.5)
            bp.paragraph_format.line_spacing=1.03
            set_run(bp.add_run('• '),8.4,True,BLUE)
            set_run(bp.add_run(b),8.8,False,TEXT)

def add_tools(doc,tools):
    section_heading(doc,'Tools & Platforms')
    for row in [tools[i:i+6] for i in range(0,len(tools),6)]:
        p=doc.add_paragraph()
        p.paragraph_format.space_after=Pt(1)
        for i,t in enumerate(row):
            if i:
                set_run(p.add_run('  |  '),8.3,False,RULE)
            set_run(p.add_run(t),8.7,False,TEXT)

def add_education(doc,certs,education):
    section_heading(doc,'Certification & Education')
    for c in certs:
        p=doc.add_paragraph()
        p.paragraph_format.space_after=Pt(1)
        set_run(p.add_run(c),9.1,True,NAVY)
    for e in education:
        p=doc.add_paragraph()
        set_run(p.add_run(e),9.0,False,TEXT)

def add_footer(section):
    p=section.footer.paragraphs[0]
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    set_run(p.add_run('Diana Marenco  |  Tailored Resume'),7.2,False,MUTED)

def render(data,out_path):
    d=Document()
    s=d.sections[0]
    s.page_width=Inches(8.5)
    s.page_height=Inches(11)
    s.top_margin=Inches(.48)
    s.bottom_margin=Inches(.45)
    s.left_margin=Inches(.58)
    s.right_margin=Inches(.58)
    d.styles['Normal'].font.name=FONT
    d.styles['Normal'].font.size=Pt(9)
    add_footer(s)

    add_header(d,data,False)
    add_summary(d,data['summary'])
    add_capabilities(d,data['core_capabilities'])
    add_impact(d,data['selected_impact'])
    section_heading(d,'Professional Experience')
    for role in data['page1_experience']:
        add_role(d,role)

    d.add_page_break()
    add_header(d,data,True)
    section_heading(d,'Additional Experience')
    for role in data['page2_experience']:
        add_role(d,role,compact=True)
    add_projects(d,data.get('projects',[]))
    add_tools(d,data['tools'])
    add_education(d,data.get('certifications',[]),data.get('education',[]))

    d.core_properties.title=f"{data['name']} - {data['headline']}"
    d.core_properties.subject='Renderer: professional-two-page-v1'
    d.save(out_path)

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('input_json')
    ap.add_argument('output_docx')
    args=ap.parse_args()
    render(json.loads(Path(args.input_json).read_text()),args.output_docx)
