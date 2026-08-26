#!/usr/bin/env python3
"""zen-vision.py — blind screenshot review via deepseek-v4-flash-vision-exp.

Usage: zen-vision.py PROMPT IMAGE [IMAGE...]   (reads prompt from argv[1], images from argv[2:])
Prints the model's final answer. Exit 1 on HTTP/transport error.
"""
import sys, json, base64, urllib.request, os

KEY_PATH = os.path.expanduser('/home/bobbyranka/.config/opencode/opencode.json')
ENDPOINT = 'https://opencode.ai/zen/go/v1/chat/completions'
MODEL = 'deepseek-v4-flash-vision-exp'

def main() -> int:
    if len(sys.argv) < 3:
        print('usage: zen-vision.py PROMPT IMAGE [IMAGE...]', file=sys.stderr)
        return 2
    prompt, images = sys.argv[1], sys.argv[2:]
    key = json.load(open(KEY_PATH))['provider']['zen']['options']['apiKey']
    content = [{'type': 'text', 'text': prompt}]
    for path in images:
        ext = 'jpeg' if path.lower().endswith(('.jpg', '.jpeg')) else 'png'
        b64 = base64.b64encode(open(path, 'rb').read()).decode()
        content.append({'type': 'image_url', 'image_url': {'url': f'data:image/{ext};base64,{b64}'}})
    body = {'model': MODEL, 'max_tokens': 9000, 'messages': [{'role': 'user', 'content': content}]}
    req = urllib.request.Request(ENDPOINT, data=json.dumps(body).encode(),
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json',
                                          'User-Agent': 'curl/8.5.0'})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        print(f'HTTP {e.code}: {e.read()[:200]!r}', file=sys.stderr)
        return 1
    message = r['choices'][0]['message']
    text = message.get('content') or ''
    if not text.strip():
        finish = r['choices'][0].get('finish_reason')
        reasoning = (message.get('reasoning_content') or '').strip()
        if reasoning:
            print(f'[no final content; finish_reason={finish}; reasoning tail below]', file=sys.stderr)
            print(reasoning[-1200:])
        else:
            print(f'[empty content; finish_reason={finish}]', file=sys.stderr)
        return 1
    print(text)
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
