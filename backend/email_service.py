"""
Email service for BENNOURI Pièces Auto.
- SMTP via web.de (or any SMTP provider)
- HTML templates with brand styling
- Async sending to avoid blocking the API
"""

import os
import ssl
import smtplib
import logging
import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)


# ---------- SMTP plumbing ----------

def _smtp_config() -> dict:
    return {
        "host": os.environ.get("SMTP_HOST", "smtp.web.de"),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER", ""),
        "password": os.environ.get("SMTP_PASSWORD", ""),
        "from_email": os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "")),
        "from_name": os.environ.get("SMTP_FROM_NAME", "BENNOURI Pièces Auto"),
        "admin_email": os.environ.get("ADMIN_EMAIL", ""),
    }


def _send_sync(to: str, subject: str, html: str, reply_to: Optional[str] = None) -> bool:
    cfg = _smtp_config()
    if not cfg["user"] or not cfg["password"] or not to:
        logger.warning("SMTP not configured or 'to' missing — skipping send")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((cfg["from_name"], cfg["from_email"]))
    msg["To"] = to
    if reply_to:
        msg["Reply-To"] = reply_to

    # Plain text fallback (simple strip)
    import re as _re
    text_fallback = _re.sub(r"<[^>]+>", "", html)
    text_fallback = _re.sub(r"\s+\n", "\n", text_fallback).strip()
    msg.attach(MIMEText(text_fallback, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        ctx = ssl.create_default_context()
        # Port 465 → implicit SSL/TLS; 587 → STARTTLS
        if cfg["port"] == 465:
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=30, context=ctx) as srv:
                srv.ehlo()
                srv.login(cfg["user"], cfg["password"])
                srv.sendmail(cfg["from_email"], [to], msg.as_string())
        else:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=30) as srv:
                srv.ehlo()
                srv.starttls(context=ctx)
                srv.ehlo()
                srv.login(cfg["user"], cfg["password"])
                srv.sendmail(cfg["from_email"], [to], msg.as_string())
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.warning(f"SMTP send error to {to}: {e}")
        return False


async def send_email(to: str, subject: str, html: str, reply_to: Optional[str] = None) -> bool:
    """Async wrapper: runs smtplib in a thread so we don't block the event loop."""
    try:
        return await asyncio.to_thread(_send_sync, to, subject, html, reply_to)
    except Exception as e:
        logger.warning(f"send_email error: {e}")
        return False


# ---------- Shared HTML chrome ----------

BRAND_RED = "#DC2626"
BRAND_NAVY = "#0F172A"
BRAND_TEXT = "#334155"
BRAND_MUTED = "#64748B"


def _wrap(title: str, hero_eyebrow: str, hero_title: str, hero_subtitle: str, body_html: str) -> str:
    """Return a complete HTML document with brand chrome."""
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Helvetica Neue',Arial,sans-serif;color:{BRAND_TEXT};">
  <div style="display:none;max-height:0;overflow:hidden;">{hero_subtitle}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,.08);">
          <!-- Top brand bar -->
          <tr>
            <td style="background:{BRAND_NAVY};padding:20px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#fff;font-family:'Helvetica Neue',Arial,sans-serif;">
                    <div style="font-size:11px;letter-spacing:4px;color:#94A3B8;text-transform:uppercase;font-weight:700;">BENNOURI</div>
                    <div style="font-size:13px;letter-spacing:2px;color:#fff;font-weight:600;margin-top:2px;">PIÈCES AUTO</div>
                  </td>
                  <td align="right" style="color:{BRAND_RED};font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">
                    Tunis · Tunisie
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero / banner -->
          <tr>
            <td style="background:linear-gradient(135deg,{BRAND_NAVY} 0%, #1E293B 60%, {BRAND_RED} 130%);padding:40px 32px;color:#fff;">
              <div style="font-size:10px;letter-spacing:5px;color:#FCA5A5;text-transform:uppercase;font-weight:700;margin-bottom:10px;">{hero_eyebrow}</div>
              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:26px;font-weight:800;color:#fff;line-height:1.2;">
                {hero_title}
              </div>
              <div style="font-size:14px;color:#CBD5E1;margin-top:10px;line-height:1.6;">{hero_subtitle}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;font-family:'Helvetica Neue',Arial,sans-serif;color:{BRAND_TEXT};font-size:15px;line-height:1.7;">
              {body_html}
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:0 32px 28px 32px;font-family:'Helvetica Neue',Arial,sans-serif;color:{BRAND_TEXT};font-size:14px;border-top:1px solid #E2E8F0;padding-top:24px;">
              <div style="margin-bottom:8px;">Cordialement,</div>
              <div style="font-weight:700;color:{BRAND_NAVY};font-size:15px;">L'équipe BENNOURI Pièces Auto</div>
              <div style="font-size:12px;color:{BRAND_MUTED};margin-top:6px;">
                Rue de France, 2043 Ben Arous, Tunisie<br/>
                <a href="tel:+21671123456" style="color:{BRAND_RED};text-decoration:none;font-weight:600;">+216 71 123 456</a> ·
                <a href="mailto:contact@bennouri.tn" style="color:{BRAND_RED};text-decoration:none;font-weight:600;">contact@bennouri.tn</a>
              </div>
            </td>
          </tr>

          <!-- Footer dark -->
          <tr>
            <td style="background:{BRAND_NAVY};padding:24px 32px;text-align:center;color:#94A3B8;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;line-height:1.6;">
              <div style="margin-bottom:8px;">
                <span style="display:inline-block;background:{BRAND_RED};color:#fff;font-weight:700;padding:4px 10px;border-radius:2px;font-size:10px;letter-spacing:2px;">PIÈCES D'ORIGINE GARANTIES</span>
              </div>
              <div>Livraison rapide en Tunisie · Paiement à la livraison · Visa &amp; Mastercard acceptés</div>
              <div style="margin-top:12px;color:#475569;">
                © 2026 BENNOURI Pièces Auto — Tous droits réservés
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# ---------- Templates ----------

def render_welcome(user_name: str, user_email: str) -> str:
    body = f"""
    <p style="font-size:16px;margin:0 0 16px 0;">Bonjour <strong style="color:{BRAND_NAVY};">{user_name}</strong>,</p>

    <p style="margin:0 0 18px 0;">
      Toute l'équipe <strong style="color:{BRAND_NAVY};">BENNOURI Pièces Auto</strong> vous souhaite la bienvenue !
      Votre compte est désormais actif et vous donne accès à notre catalogue complet de pièces d'origine
      pour toutes les marques européennes, japonaises et coréennes.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border-left:4px solid {BRAND_RED};border-radius:4px;margin:24px 0;">
      <tr>
        <td style="padding:18px 20px;">
          <div style="font-size:11px;letter-spacing:2px;color:{BRAND_RED};text-transform:uppercase;font-weight:700;margin-bottom:6px;">Vos avantages</div>
          <ul style="margin:0;padding-left:20px;color:{BRAND_TEXT};">
            <li style="margin:4px 0;">Recherche par <strong>VIN</strong> ou par <strong>marque/modèle</strong></li>
            <li style="margin:4px 0;">Catalogue OEM officiel avec numéros de référence</li>
            <li style="margin:4px 0;">Pièces d'oriine garanties</li>
            <li style="margin:4px 0;">Paiement à la livraison sécurisé</li>
            <li style="margin:4px 0;">Livraison rapide partout en Tunisie</li>
          </ul>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px 0;">
      Pour commencer, il vous suffit de saisir le <strong>VIN</strong>
      de votre véhicule, et nous trouverons les pièces parfaitement compatibles.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:{BRAND_RED};border-radius:3px;">
          <a href="https://bennouri.tn/recherche-vin"
             style="display:inline-block;padding:14px 28px;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
            COMMENCER MA RECHERCHE →
          </a>
        </td>
      </tr>
    </table>

    <p style="font-size:13px;color:{BRAND_MUTED};margin:24px 0 0 0;">
      Une question ? Une demande spécifique ? Notre équipe est joignable du lundi au samedi de 8h à 20h
      au <a href="tel:+21671123456" style="color:{BRAND_RED};font-weight:600;text-decoration:none;">+216 71 123 456</a>.
    </p>
    """
    return _wrap(
        title=f"Bienvenue chez BENNOURI, {user_name}",
        hero_eyebrow="Bienvenue",
        hero_title=f"Bonjour {user_name.split(' ')[0]}, ravi de vous compter parmi nous !",
        hero_subtitle="Votre compte BENNOURI Pièces Auto est prêt. Découvrez notre catalogue de pièces d'origine.",
        body_html=body,
    )


def render_password_reset(user_name: str, reset_url: str) -> str:
    body = f"""
    <p style="font-size:16px;margin:0 0 16px 0;">Bonjour <strong style="color:{BRAND_NAVY};">{user_name}</strong>,</p>

    <p style="margin:0 0 18px 0;">
      Vous avez demandé la réinitialisation de votre mot de passe pour votre compte
      <strong style="color:{BRAND_NAVY};">BENNOURI Pièces Auto</strong>.
      Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:{BRAND_RED};border-radius:3px;">
          <a href="{reset_url}"
             style="display:inline-block;padding:14px 28px;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
            RÉINITIALISER MON MOT DE PASSE →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 18px 0;font-size:13px;color:{BRAND_MUTED};">
      Ce lien est valable <strong>30 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande,
      ignorez simplement cet email — votre mot de passe restera inchangé.
    </p>
    """
    return _wrap(
        title="Réinitialisation de votre mot de passe · BENNOURI",
        hero_eyebrow="Sécurité du compte",
        hero_title="Réinitialisation de mot de passe",
        hero_subtitle="Ce lien expire dans 30 minutes.",
        body_html=body,
    )


async def send_password_reset_email(user_name: str, user_email: str, token: str) -> bool:
    frontend_url = os.environ.get("FRONTEND_URL", "https://bennouri.tn")
    reset_url = f"{frontend_url}/reinitialiser-mot-de-passe?token={token}"
    html = render_password_reset(user_name, reset_url)
    return await send_email(
        to=user_email,
        subject="Réinitialisation de votre mot de passe — BENNOURI",
        html=html,
    )

def render_order_confirmation(order: Dict) -> str:
    items = order.get("items", [])
    items_rows = ""
    for it in items:
        unit = float(it.get("unit_price_tnd") or 0)
        line = float(it.get("line_total_tnd") or 0)
        items_rows += f"""
          <tr>
            <td style="padding:12px 8px;border-bottom:1px solid #E2E8F0;font-family:'Courier New',monospace;font-size:12px;color:{BRAND_NAVY};font-weight:700;white-space:nowrap;">
              {it.get('ref','')}
            </td>
            <td style="padding:12px 8px;border-bottom:1px solid #E2E8F0;font-size:13px;color:{BRAND_TEXT};">
              <div style="font-weight:600;color:{BRAND_NAVY};">{it.get('name','')}</div>
              <div style="font-size:11px;color:{BRAND_MUTED};margin-top:2px;">{it.get('brand','')}</div>
            </td>
            <td align="center" style="padding:12px 8px;border-bottom:1px solid #E2E8F0;font-size:13px;color:{BRAND_TEXT};">
              x{it.get('quantity',1)}
            </td>
            <td align="right" style="padding:12px 8px;border-bottom:1px solid #E2E8F0;font-size:13px;color:{BRAND_TEXT};white-space:nowrap;">
              {unit:.3f} DT
            </td>
            <td align="right" style="padding:12px 8px;border-bottom:1px solid #E2E8F0;font-size:13px;color:{BRAND_NAVY};font-weight:700;white-space:nowrap;">
              {line:.3f} DT
            </td>
          </tr>
        """

    order_id_short = (order.get("id") or "")[:8].upper()
    total = float(order.get("total_tnd") or 0)
    vehicle = (order.get("vehicle_label") or "—")
    vin = order.get("vehicle_vin") or "—"
    address = order.get("shipping_address") or "—"
    phone = order.get("phone") or "—"

    body = f"""
    <p style="font-size:16px;margin:0 0 16px 0;">Bonjour <strong style="color:{BRAND_NAVY};">{order.get('customer_name') or order.get('user_name','')}</strong>,</p>

    <p style="margin:0 0 18px 0;">
      Merci pour votre commande chez <strong style="color:{BRAND_NAVY};">BENNOURI Pièces Auto</strong> !
      Nous l'avons bien reçue et nous la préparons dès à présent. Voici le récapitulatif&nbsp;:
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:4px;margin:18px 0;">
      <tr>
        <td style="padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:10px;letter-spacing:3px;color:{BRAND_RED};text-transform:uppercase;font-weight:700;margin-bottom:4px;">Numéro de commande</div>
                <div style="font-family:'Courier New',monospace;font-size:18px;font-weight:800;color:{BRAND_NAVY};">#{order_id_short}</div>
              </td>
              <td align="right">
                <div style="font-size:10px;letter-spacing:3px;color:{BRAND_RED};text-transform:uppercase;font-weight:700;margin-bottom:4px;">Statut</div>
                <div style="display:inline-block;background:#FEF3C7;color:#92400E;font-weight:700;padding:4px 12px;border-radius:3px;font-size:12px;">EN ATTENTE</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="margin:24px 0 12px 0;font-size:12px;letter-spacing:2px;color:{BRAND_RED};text-transform:uppercase;font-weight:700;">Articles commandés</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:4px;overflow:hidden;">
      <thead>
        <tr style="background:#F1F5F9;">
          <th align="left" style="padding:10px 8px;font-size:10px;letter-spacing:1px;color:{BRAND_MUTED};text-transform:uppercase;font-weight:700;">Référence</th>
          <th align="left" style="padding:10px 8px;font-size:10px;letter-spacing:1px;color:{BRAND_MUTED};text-transform:uppercase;font-weight:700;">Désignation</th>
          <th align="center" style="padding:10px 8px;font-size:10px;letter-spacing:1px;color:{BRAND_MUTED};text-transform:uppercase;font-weight:700;">Qté</th>
          <th align="right" style="padding:10px 8px;font-size:10px;letter-spacing:1px;color:{BRAND_MUTED};text-transform:uppercase;font-weight:700;">P.U.</th>
          <th align="right" style="padding:10px 8px;font-size:10px;letter-spacing:1px;color:{BRAND_MUTED};text-transform:uppercase;font-weight:700;">Total</th>
        </tr>
      </thead>
      <tbody>
        {items_rows}
      </tbody>
      <tfoot>
        <tr style="background:{BRAND_NAVY};">
          <td colspan="4" align="right" style="padding:14px 12px;color:#94A3B8;font-size:13px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">Total TTC</td>
          <td align="right" style="padding:14px 12px;color:#fff;font-size:18px;font-weight:800;white-space:nowrap;">{total:.3f} DT</td>
        </tr>
      </tfoot>
    </table>

    <div style="margin:28px 0 12px 0;font-size:12px;letter-spacing:2px;color:{BRAND_RED};text-transform:uppercase;font-weight:700;">Livraison</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:4px;">
      <tr>
        <td style="padding:16px 20px;font-size:13px;color:{BRAND_TEXT};line-height:1.7;">
          <strong style="color:{BRAND_NAVY};">{order.get('customer_name') or order.get('user_name','')}</strong><br/>
          {address}<br/>
          <span style="color:{BRAND_MUTED};">Tél&nbsp;:</span> {phone}
        </td>
      </tr>
    </table>

    <div style="margin:24px 0 12px 0;font-size:12px;letter-spacing:2px;color:{BRAND_RED};text-transform:uppercase;font-weight:700;">Véhicule concerné</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:4px;">
      <tr>
        <td style="padding:16px 20px;font-size:13px;color:{BRAND_TEXT};">
          <strong style="color:{BRAND_NAVY};">{vehicle}</strong><br/>
          <span style="font-family:'Courier New',monospace;font-size:12px;color:{BRAND_MUTED};">{vin}</span>
        </td>
      </tr>
    </table>

    <p style="margin:28px 0 0 0;font-size:13px;color:{BRAND_MUTED};">
      <strong style="color:{BRAND_NAVY};">Mode de paiement&nbsp;:</strong> {order.get('payment_method','Paiement à la livraison')}<br/>
      Vous recevrez un nouvel email dès que votre commande sera expédiée.
      En attendant, notre service client est à votre disposition au
      <a href="tel:+21671123456" style="color:{BRAND_RED};font-weight:600;text-decoration:none;">+216 71 123 456</a>.
    </p>
    """
    return _wrap(
        title=f"Confirmation commande #{order_id_short} · BENNOURI",
        hero_eyebrow="Confirmation",
        hero_title=f"Commande #{order_id_short} confirmée",
        hero_subtitle=f"Merci pour votre confiance · Total {total:.3f} DT",
        body_html=body,
    )


def render_contact_to_admin(contact: Dict) -> str:
    name = contact.get("name", "")
    email = contact.get("email", "")
    phone = contact.get("phone", "")
    subject = contact.get("subject", "")
    message = contact.get("message", "")

    body = f"""
    <p style="font-size:15px;margin:0 0 18px 0;">Un nouveau message de contact a été reçu via le formulaire du site&nbsp;:</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:4px;margin:18px 0;">
      <tr>
        <td style="padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:12px;color:{BRAND_MUTED};width:120px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Nom</td>
              <td style="padding:6px 0;font-size:14px;color:{BRAND_NAVY};font-weight:600;">{name}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:12px;color:{BRAND_MUTED};text-transform:uppercase;letter-spacing:1px;font-weight:700;">Email</td>
              <td style="padding:6px 0;font-size:14px;color:{BRAND_NAVY};">
                <a href="mailto:{email}" style="color:{BRAND_RED};text-decoration:none;font-weight:600;">{email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:12px;color:{BRAND_MUTED};text-transform:uppercase;letter-spacing:1px;font-weight:700;">Téléphone</td>
              <td style="padding:6px 0;font-size:14px;color:{BRAND_NAVY};">
                {f'<a href="tel:{phone}" style="color:{BRAND_RED};text-decoration:none;font-weight:600;">{phone}</a>' if phone else '<span style="color:#94A3B8;">—</span>'}
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:12px;color:{BRAND_MUTED};text-transform:uppercase;letter-spacing:1px;font-weight:700;">Sujet</td>
              <td style="padding:6px 0;font-size:14px;color:{BRAND_NAVY};font-weight:600;">{subject or '—'}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="margin:24px 0 8px 0;font-size:11px;letter-spacing:2px;color:{BRAND_RED};text-transform:uppercase;font-weight:700;">Message</div>
    <div style="background:#fff;border:1px solid #E2E8F0;border-left:4px solid {BRAND_RED};border-radius:4px;padding:18px 20px;font-size:14px;color:{BRAND_TEXT};line-height:1.7;white-space:pre-wrap;">{message}</div>

    <p style="margin:28px 0 0 0;font-size:13px;color:{BRAND_MUTED};">
      Vous pouvez répondre directement à cet email — la réponse sera adressée à <strong style="color:{BRAND_NAVY};">{email}</strong>.
    </p>
    """
    return _wrap(
        title=f"Nouveau message de contact — {name}",
        hero_eyebrow="Message de contact",
        hero_title=f"Nouveau contact de {name}",
        hero_subtitle=subject or "Sans sujet",
        body_html=body,
    )


# ---------- Public helpers (high-level) ----------

async def send_welcome_email(user_name: str, user_email: str) -> bool:
    html = render_welcome(user_name, user_email)
    return await send_email(
        to=user_email,
        subject="Bienvenue chez BENNOURI Pièces Auto 🚗",
        html=html,
    )


async def send_order_confirmation(order: Dict) -> bool:
    to = order.get("user_email") or ""
    if not to:
        return False
    order_id_short = (order.get("id") or "")[:8].upper()
    html = render_order_confirmation(order)
    return await send_email(
        to=to,
        subject=f"Confirmation de votre commande #{order_id_short} — BENNOURI",
        html=html,
    )


async def send_contact_to_admin(contact: Dict) -> bool:
    cfg = _smtp_config()
    admin = cfg["admin_email"]
    if not admin:
        return False
    html = render_contact_to_admin(contact)
    return await send_email(
        to=admin,
        subject=f"[Contact site] {contact.get('subject') or 'Sans sujet'} — {contact.get('name','')}",
        html=html,
        reply_to=contact.get("email"),
    )
