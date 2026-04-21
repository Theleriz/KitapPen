from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.conf import settings

from api.models import UserNotificationSettings, ReadingSession


class Command(BaseCommand):
    help = 'Send reading reminder emails to users who have not read today'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print who would receive emails without actually sending',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Bypass hour/already-sent checks and send to all enabled users',
        )
        parser.add_argument(
            '--subject',
            type=str,
            default=None,
            help='Custom email subject (implies --force)',
        )
        parser.add_argument(
            '--message',
            type=str,
            default=None,
            help='Custom plain-text email body (implies --force)',
        )
        parser.add_argument(
            '--user',
            type=str,
            default=None,
            help='Send only to this username (can combine with --force/--subject/--message)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        custom_subject = options['subject']
        custom_message = options['message']
        target_user = options['user']
        force = options['force'] or bool(custom_subject or custom_message)

        today = timezone.now().date()
        current_hour = timezone.now().hour
        sent = 0
        skipped = 0

        qs = UserNotificationSettings.objects.filter(
            email_notifications_enabled=True
        ).select_related('user')

        if target_user:
            qs = qs.filter(user__username=target_user)

        for ns in qs:
            user = ns.user

            if not user.email:
                self.stdout.write(f'Skip {user.username}: no email')
                skipped += 1
                continue

            if not force:
                if ns.last_sent_at and ns.last_sent_at.date() == today:
                    skipped += 1
                    continue

                if current_hour != ns.reminder_hour:
                    skipped += 1
                    continue

                has_read_today = ReadingSession.objects.filter(
                    user=user, started_at__date=today
                ).exists()
                if has_read_today:
                    skipped += 1
                    continue

            subject = custom_subject or 'Не забудь почитать сегодня 📚'
            plain = custom_message or f'Привет, {user.username}! Сегодня ты ещё не читал. Открой BookTracker и продолжи чтение.'

            if custom_subject or custom_message:
                html_message = self._render_custom(user, subject, plain)
            else:
                last_session = ReadingSession.objects.filter(user=user).order_by('-started_at').first()
                last_book = last_session.book if last_session else None
                streak_days = self._calculate_streak(user, today)
                html_message = render_to_string('api/emails/reading_reminder.html', {
                    'username': user.username,
                    'last_book': last_book,
                    'streak_days': streak_days,
                })

            if dry_run:
                self.stdout.write(f'[DRY RUN] {user.username} <{user.email}> | {subject}')
                sent += 1
                continue

            send_mail(
                subject=subject,
                message=plain,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False,
            )

            ns.last_sent_at = timezone.now()
            ns.save(update_fields=['last_sent_at'])
            sent += 1
            self.stdout.write(f'Sent: {user.username} <{user.email}>')

        self.stdout.write(self.style.SUCCESS(f'Done. Sent: {sent}, skipped: {skipped}.'))

    def _render_custom(self, user, subject, message):
        return f"""<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;color:#333">
  <h2 style="color:#4a90e2">📚 BookTracker</h2>
  <p>Привет, <strong>{user.username}</strong>!</p>
  <p style="line-height:1.6">{message}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#999">BookTracker — твой трекер чтения</p>
</body></html>"""

    def _calculate_streak(self, user, today):
        sessions = ReadingSession.objects.filter(user=user, is_active=False).order_by('-started_at')
        unique_days = sorted({s.started_at.date() for s in sessions}, reverse=True)
        if not unique_days:
            return 0

        streak = 0
        expected = today
        for day in unique_days:
            if day == expected:
                streak += 1
                expected = day - timezone.timedelta(days=1)
            elif day < expected:
                break
        return streak
