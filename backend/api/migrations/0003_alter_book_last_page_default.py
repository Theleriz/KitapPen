from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_book_is_public_book_last_page_alter_book_user_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='book',
            name='last_page',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
