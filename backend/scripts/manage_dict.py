#!/usr/bin/env python3
"""
Pronunciation dictionary manager — CLI wrapper around SarvamTTS dict methods.

Usage:
    python backend/scripts/manage_dict.py create --file my_terms.json
    python backend/scripts/manage_dict.py list
    python backend/scripts/manage_dict.py show --id p_abc123
    python backend/scripts/manage_dict.py delete --id p_abc123
    python backend/scripts/manage_dict.py template
"""

import sys
import pathlib

# Ensure the backend directory takes priority on the python path
_script_dir = pathlib.Path(__file__).parent.resolve()
_backend_dir = _script_dir.parent.resolve()
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

import argparse
import json
import os
from dotenv import load_dotenv

load_dotenv()


def _client():
    api_key = os.getenv("SARVAM_API_KEY", "")
    if not api_key:
        print("ERROR: SARVAM_API_KEY not set in environment / .env")
        sys.exit(1)
    from tts.sarvam_tts import SarvamTTS
    return SarvamTTS(api_key)


def cmd_create(args):
    with open(args.file, "r", encoding="utf-8") as f:
        data = json.load(f)
    pronunciations = data.get("pronunciations", data)
    tts = _client()
    dict_id = tts.create_pronunciation_dict(pronunciations)
    print(f"Created dictionary: {dict_id}")


def cmd_list(args):
    dicts = _client().list_pronunciation_dicts()
    if not dicts:
        print("No pronunciation dictionaries found.")
        return
    for d in dicts:
        did = d.get("dictionary_id") or d.get("id") or str(d)
        name = d.get("name", "")
        print(f"  {did}  {name}")


def cmd_show(args):
    result = _client().get_pronunciation_dict(args.id)
    print(json.dumps(result if isinstance(result, dict) else vars(result), ensure_ascii=False, indent=2))


def cmd_delete(args):
    _client().delete_pronunciation_dict(args.id)
    print(f"Deleted: {args.id}")


def cmd_template(args):
    sample = {
        "pronunciations": {
            "en-IN": {"API": "A P I", "SQL": "sequel", "GUI": "gooey"},
            "hi-IN": {"KYC": "K Y C", "OTP": "O T P"},
        }
    }
    print(json.dumps(sample, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description="Manage Sarvam AI pronunciation dictionaries")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create", help="Upload a dictionary JSON file")
    p_create.add_argument("--file", required=True, help="Path to pronunciations JSON")

    sub.add_parser("list", help="List all saved dictionaries")

    p_show = sub.add_parser("show", help="Show contents of a dictionary")
    p_show.add_argument("--id", required=True, metavar="DICT_ID")

    p_delete = sub.add_parser("delete", help="Delete a dictionary")
    p_delete.add_argument("--id", required=True, metavar="DICT_ID")

    sub.add_parser("template", help="Print a sample pronunciations JSON")

    args = parser.parse_args()
    {"create": cmd_create, "list": cmd_list, "show": cmd_show,
     "delete": cmd_delete, "template": cmd_template}[args.command](args)


if __name__ == "__main__":
    main()
