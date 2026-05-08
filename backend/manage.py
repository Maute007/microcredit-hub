#!/usr/bin/env python
import os
import sys


def main() -> None:
    """Run administrative tasks."""
    # Force the correct settings module even if the shell
    # already has DJANGO_SETTINGS_MODULE from another project.
    os.environ["DJANGO_SETTINGS_MODULE"] = "Server_microcredit.settings"
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()

