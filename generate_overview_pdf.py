"""Generate a client-facing overview PDF for GC Business Hub."""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle,
    KeepTogether,
)

BASE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(BASE, "GC-New-Logo-No-Border.jpg")
OUT = os.path.join(BASE, "GC-Inventory-Hub-Overview.pdf")

# Brand colors — Goodman Classic (black + Chore-Time red)
BRAND_BLACK = HexColor("#111111")
BRAND_RED = HexColor("#c8202c")
BRAND_RED_DARK = HexColor("#9b1620")
GRAY_900 = HexColor("#111111")
GRAY_800 = HexColor("#1f2937")
GRAY_700 = HexColor("#374151")
GRAY_500 = HexColor("#6b7280")
GRAY_400 = HexColor("#9ca3af")
GRAY_300 = HexColor("#d1d5db")
GRAY_200 = HexColor("#e5e7eb")
GRAY_100 = HexColor("#f3f4f6")
GRAY_50 = HexColor("#f9fafb")

ACTIVE_ACCENT = BRAND_BLACK
COMING_SOON_ACCENT = BRAND_RED
PREMIUM_ACCENT = GRAY_400

PAGE_W, PAGE_H = letter
MARGIN = 0.6 * inch

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "Title", parent=styles["Title"], fontSize=30, textColor=GRAY_900,
    leading=36, spaceAfter=6, alignment=TA_CENTER, fontName="Helvetica-Bold",
)
subtitle_style = ParagraphStyle(
    "Subtitle", parent=styles["Normal"], fontSize=13, textColor=GRAY_500,
    leading=18, spaceAfter=18, alignment=TA_CENTER,
)
h1 = ParagraphStyle(
    "H1", parent=styles["Heading1"], fontSize=20, textColor=GRAY_900,
    leading=25, spaceBefore=6, spaceAfter=4, fontName="Helvetica-Bold",
)
h2 = ParagraphStyle(
    "H2", parent=styles["Heading2"], fontSize=14, textColor=GRAY_900,
    leading=18, spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold",
)
h3 = ParagraphStyle(
    "H3", parent=styles["Heading3"], fontSize=10, textColor=GRAY_700,
    leading=13, spaceBefore=8, spaceAfter=4, fontName="Helvetica-Bold",
)
section_intro = ParagraphStyle(
    "SectionIntro", parent=styles["Normal"], fontSize=10, textColor=GRAY_500,
    leading=14, spaceAfter=12,
)
body = ParagraphStyle(
    "Body", parent=styles["Normal"], fontSize=10, textColor=GRAY_700,
    leading=14, spaceAfter=6,
)
body_sm = ParagraphStyle(
    "BodySm", parent=styles["Normal"], fontSize=9, textColor=GRAY_500,
    leading=12, spaceAfter=4,
)


def accent_rule(color, width_in=0.7, thickness=3):
    """A short colored underline used below section titles."""
    t = Table([[""]], colWidths=[width_in * inch], rowHeights=[thickness])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    t.hAlign = "LEFT"
    return t


def feature_card(label, desc, accent_color, badge_text=None, badge_color=None):
    label_para = Paragraph(f"<b>{label}</b>", ParagraphStyle(
        "card_label", parent=body, fontSize=10, textColor=GRAY_900,
        leading=13, fontName="Helvetica-Bold", spaceAfter=2,
    ))
    desc_para = Paragraph(desc, ParagraphStyle(
        "card_desc", parent=body_sm, fontSize=8.5, textColor=GRAY_500, leading=11,
    ))
    inner = [[label_para], [desc_para]]
    if badge_text:
        badge = Paragraph(
            f'<font color="#{badge_color.hexval()[2:]}"><b>{badge_text}</b></font>',
            ParagraphStyle("badge", parent=body_sm, fontSize=7.5, leading=10,
                           fontName="Helvetica-Bold"),
        )
        inner.insert(1, [badge])
    t = Table(inner, colWidths=[2.1 * inch])
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_200),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent_color),
    ]))
    return t


def feature_grid(features, accent_color, badge_text=None, badge_color=None, cols=3):
    cards = [feature_card(f["label"], f["desc"], accent_color, badge_text, badge_color) for f in features]
    rows = []
    for i in range(0, len(cards), cols):
        row = cards[i:i + cols]
        while len(row) < cols:
            row.append("")
        rows.append(row)
    col_widths = [2.25 * inch] * cols
    t = Table(rows, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def section_header(title, intro_text):
    return [
        Paragraph(title, h1),
        accent_rule(BRAND_RED, width_in=0.7, thickness=3),
        Spacer(1, 6),
        Paragraph(intro_text, section_intro),
    ]


def checklist_table(rows):
    header = [
        Paragraph("<b>Item</b>", ParagraphStyle("ch_h", parent=body, fontSize=9.5, textColor=white, fontName="Helvetica-Bold")),
        Paragraph("<b>What's needed</b>", ParagraphStyle("ch_h", parent=body, fontSize=9.5, textColor=white, fontName="Helvetica-Bold")),
        Paragraph("<b>Status</b>", ParagraphStyle("ch_h2", parent=body, fontSize=9.5, textColor=white, fontName="Helvetica-Bold", alignment=TA_CENTER)),
    ]
    data = [header]
    for label, desc, status in rows:
        status_color = BRAND_RED if status == "Needs Cleanup" else (BRAND_BLACK if status == "Provided" else GRAY_500)
        data.append([
            Paragraph(f"<b>{label}</b>", ParagraphStyle("ch_label", parent=body, fontSize=9.5, textColor=GRAY_900, fontName="Helvetica-Bold", leading=12)),
            Paragraph(desc, ParagraphStyle("ch_desc", parent=body_sm, fontSize=8.5, textColor=GRAY_500, leading=11)),
            Paragraph(
                f'<font color="#{status_color.hexval()[2:]}"><b>{status}</b></font>',
                ParagraphStyle("st", parent=body_sm, fontSize=9, alignment=TA_CENTER, fontName="Helvetica-Bold"),
            ),
        ])
    t = Table(data, colWidths=[1.55 * inch, 4.2 * inch, 1.25 * inch], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLACK),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, GRAY_50]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, BRAND_BLACK),
        ("LINEBELOW", (0, 1), (-1, -2), 0.3, GRAY_200),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_300),
        ("VALIGN", (0, 1), (-1, -1), "TOP"),
        ("VALIGN", (0, 0), (-1, 0), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
    ]))
    return t


# === CONTENT ===

active_features = [
    {"label": "Inventory Management", "desc": "Multi-location tracking with bin locations and real-time counts"},
    {"label": "Quote Templates", "desc": "Reusable templates for fast quote creation"},
    {"label": "Build Tracker", "desc": "Material allocation, usage recording, surplus capture on close-out"},
    {"label": "Surplus Management", "desc": "Track leftover materials for reuse on future builds"},
    {"label": "Purchase Orders", "desc": "Create POs with line items, receive inventory with audit trail"},
    {"label": "Invoices", "desc": "Full line-item invoices with email tracking"},
    {"label": "Transfers", "desc": "Move inventory between warehouse, stores, and build sites"},
    {"label": "Physical Counts", "desc": "Structured cycle count workflow with variance tracking"},
    {"label": "Auto Reorder Suggestions", "desc": "Reorder points based on usage history"},
    {"label": "PO Auto-Generation", "desc": "Automatically create POs for low-stock items"},
    {"label": "A/R and A/P Dashboards", "desc": "Aging buckets for receivables and payables"},
    {"label": "Reports", "desc": "Inventory value, low stock, build variance, surplus aging"},
    {"label": "CSV Import", "desc": "One-time data migration from existing systems"},
]

coming_soon = [
    {"label": "QuickBooks Online Integration", "desc": "Push POs and invoices to QBO, sync customers/vendors, track email delivery status."},
    {"label": "Square POS Integration", "desc": "Real-time inventory sync with Square POS at store locations. Sales automatically deduct stock."},
]

premium = [
    {"label": "Barcode / QR Scanning", "desc": "Scan items with your phone camera for instant lookup, stock adjustments, and physical counts."},
    {"label": "Customer Portal", "desc": "Unique link for customers to view quotes, approve them, and check invoice status."},
    {"label": "Delivery / Dispatch Tracker", "desc": "Track deliveries to job sites: what's being sent, who's driving, when it left."},
    {"label": "Notifications & Alerts", "desc": "Email and push notifications for low stock, PO received, invoice viewed, build close-out."},
    {"label": "Activity Feed", "desc": "Company-wide activity log with filters by user, date, and action type."},
    {"label": "Profitability Analytics", "desc": "Margin analysis per customer, per job type, per product line."},
    {"label": "Sales Forecasting", "desc": "Predict demand based on historical usage and seasonal patterns."},
    {"label": "Payment Processing", "desc": "Accept credit card payments on invoices directly through the portal."},
    {"label": "Maintenance Scheduling", "desc": "Track equipment and vehicle maintenance schedules and history."},
    {"label": "Photo Attachments", "desc": "Attach photos to builds, surplus items, damage reports, and inventory items."},
    {"label": "Warranty Tracking", "desc": "Track warranties on items sold to customers. Get notified before warranties expire."},
]

data_needs = [
    ("Inventory Items", "Full item list: SKU, name, description, category, unit of measure. Current data is partially entered and requires cleanup (duplicates, missing fields, inconsistent naming).", "Needs Cleanup"),
    ("Starting Stock Counts", "Accurate on-hand quantities per item, per location (warehouse / Store 1 / Store 2). Ideally captured via a physical count at go-live.", "Needed"),
    ("Cost & Sell Prices", "Current cost price (what you pay) and sell price (what you charge) for every inventory item.", "Needs Cleanup"),
    ("Categories", "Confirmed category structure — how items should be grouped (e.g., Fencing, Concrete, Hardware, Feed, etc.).", "Needs Cleanup"),
    ("Vendors", "List of vendors with contact name, email, phone, and payment terms. Flag preferred vendor per item if applicable.", "Needs Cleanup"),
    ("Reorder Points", "Minimum on-hand level per item that should trigger a reorder alert, plus the default reorder quantity.", "Needed"),
    ("Lead Times", "Typical days between placing a PO and receiving inventory — per vendor or per item. Used for reorder timing.", "Needed"),
    ("Locations & Bins", "Final list of stock locations (warehouse, each store) and any bin/aisle structure within them.", "Needs Cleanup"),
    ("Customer List", "Customers who receive quotes and invoices: name, contact info, billing address, payment terms.", "Needs Cleanup"),
]

access_needs = [
    ("User Accounts", "List of people who need access, with role assigned: Admin, Office, Store, or Foreman. Email address per user.", "Needed"),
    ("QuickBooks Online Access", "Admin access to your QBO company file so we can authorize the integration (OAuth). Required for QBO sync.", "Needed"),
    ("Square Account Access", "Admin access to your Square dashboard so we can authorize the integration for POS sync. (Only needed when Square integration is activated.)", "Needed"),
]

optional_needs = [
    ("Open Transactions", "Any open POs, invoices, quotes, or active builds you want migrated in at go-live rather than starting fresh.", "Optional"),
]


# === PAGE DECORATIONS (header/footer callbacks) ===

def draw_footer(canvas, doc):
    canvas.saveState()
    # Thin red rule above footer
    canvas.setStrokeColor(BRAND_RED)
    canvas.setLineWidth(1.5)
    canvas.line(MARGIN, 0.45 * inch, PAGE_W - MARGIN, 0.45 * inch)
    # Footer text
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GRAY_500)
    canvas.drawString(MARGIN, 0.3 * inch, "Goodman Classic Buildings & Equipment")
    canvas.drawRightString(PAGE_W - MARGIN, 0.3 * inch, f"Page {doc.page}")
    canvas.restoreState()


def draw_header_and_footer(canvas, doc):
    canvas.saveState()
    # Header: right-aligned brand text + thin rule
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(GRAY_900)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.42 * inch, "GC INVENTORY HUB")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GRAY_500)
    canvas.drawString(MARGIN, PAGE_H - 0.42 * inch, "Goodman Classic Buildings & Equipment")
    canvas.setStrokeColor(GRAY_300)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, PAGE_H - 0.5 * inch, PAGE_W - MARGIN, PAGE_H - 0.5 * inch)
    canvas.restoreState()
    draw_footer(canvas, doc)


# === BUILD PDF ===

doc = SimpleDocTemplate(
    OUT, pagesize=letter,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=0.75 * inch, bottomMargin=0.75 * inch,
)

story = []

# --- COVER ---
story.append(Spacer(1, 0.5 * inch))
try:
    logo = Image(LOGO, width=5.0 * inch, height=3.2 * inch, kind="proportional")
    logo.hAlign = "CENTER"
    story.append(logo)
except Exception:
    pass
story.append(Spacer(1, 0.5 * inch))

# Red divider bar above title
divider = Table([[""]], colWidths=[1.2 * inch], rowHeights=[4])
divider.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), BRAND_RED)]))
divider.hAlign = "CENTER"
story.append(divider)
story.append(Spacer(1, 0.18 * inch))

story.append(Paragraph("GC Business Hub", title_style))
story.append(Paragraph("System Overview &amp; Implementation Checklist", subtitle_style))
story.append(Spacer(1, 0.15 * inch))

intro_box = Table(
    [[Paragraph(
        "This document outlines the inventory management system being built for your business — "
        "what's included and ready to use today, what's coming as part of the build, and what "
        "we'll need from you to finish setting it up. Use the checklist at the end as a punch "
        "list on your side.",
        body,
    )]],
    colWidths=[6.5 * inch],
)
intro_box.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), GRAY_50),
    ("BOX", (0, 0), (-1, -1), 0.5, GRAY_300),
    ("LINEBEFORE", (0, 0), (0, -1), 3, BRAND_RED),
    ("LEFTPADDING", (0, 0), (-1, -1), 14),
    ("RIGHTPADDING", (0, 0), (-1, -1), 14),
    ("TOPPADDING", (0, 0), (-1, -1), 12),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
]))
story.append(intro_box)

story.append(PageBreak())

# --- ACTIVE FEATURES ---
story.extend(section_header(
    "What's Included",
    "These features are built, tested, and ready to use the moment your data is loaded. No additional development required.",
))
story.append(feature_grid(active_features, ACTIVE_ACCENT))

story.append(Spacer(1, 16))

# --- COMING SOON ---
story.extend(section_header(
    "Coming Soon (Part of This Build)",
    "These integrations are actively on the roadmap and will be added to your system as part of the current build.",
))
story.append(feature_grid(coming_soon, COMING_SOON_ACCENT, badge_text="COMING SOON", badge_color=COMING_SOON_ACCENT, cols=2))

story.append(PageBreak())

# --- PREMIUM FEATURES ---
story.extend(section_header(
    "Premium Features Available",
    "Optional capabilities that can be added to your system — not included in the base build, but ready to develop when you decide you want them.",
))
story.append(feature_grid(premium, PREMIUM_ACCENT, badge_text="PREMIUM", badge_color=BRAND_RED_DARK))

story.append(PageBreak())

# --- WHAT WE NEED FROM YOU ---
story.extend(section_header(
    "What We Need From You",
    "To finish setup and go live, we need the following from your team. Some of this data is already partially loaded but needs cleanup; other items are still to be gathered. The status column shows where each item stands.",
))

story.append(Paragraph("Status key", h3))
key_data = [
    [Paragraph('<font color="#c8202c"><b>Needs Cleanup</b></font>', body_sm),
     Paragraph("Partially in the system — needs review and correction before go-live.", body_sm)],
    [Paragraph('<font color="#6b7280"><b>Needed</b></font>', body_sm),
     Paragraph("Not yet provided — please gather and send over.", body_sm)],
    [Paragraph('<font color="#6b7280"><b>Optional</b></font>', body_sm),
     Paragraph("Helpful but not required to go live.", body_sm)],
]
key_table = Table(key_data, colWidths=[1.2 * inch, 5.6 * inch])
key_table.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 1),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
]))
story.append(key_table)
story.append(Spacer(1, 14))

story.append(Paragraph("Data to clean up or gather", h3))
story.append(checklist_table(data_needs))
story.append(Spacer(1, 12))

story.append(Paragraph("Access &amp; credentials", h3))
story.append(checklist_table(access_needs))
story.append(Spacer(1, 12))

story.append(Paragraph("Optional migration", h3))
story.append(checklist_table(optional_needs))

story.append(Spacer(1, 16))

story.append(Paragraph("Next Steps", h2))
story.append(accent_rule(BRAND_RED, width_in=0.5, thickness=2))
story.append(Spacer(1, 4))
next_steps_text = (
    "1.&nbsp;&nbsp;Review this document and flag any features you'd like to add, remove, or prioritize differently.<br/><br/>"
    "2.&nbsp;&nbsp;Work through the checklist above — items marked <b>Needs Cleanup</b> can be reviewed directly in the system; items marked <b>Needed</b> can be sent over as spreadsheets or lists.<br/><br/>"
    "3.&nbsp;&nbsp;Once the data is cleaned up and the integration credentials are provided, we'll schedule go-live training for your team."
)
story.append(Paragraph(next_steps_text, body))

doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_header_and_footer)
print(f"Generated: {OUT}")
