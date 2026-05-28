import sys, os, base64, time, json
import urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(__file__))
os.chdir(os.path.dirname(__file__))

from app.config import settings
from jose import jwt, JWTError

REAL_USER_ID = "54bd56a1-895c-4e7c-a5ee-4b20be4aa05c"
secret = settings.supabase_jwt_secret

print("=== 1. SECRET CHECK ===")
print(f"Length  : {len(secret)}")
print(f"Preview : {secret[:10]}...{secret[-5:]}")
try:
    decoded_bytes = base64.b64decode(secret + "==")
    print(f"Valid base64: YES ({len(decoded_bytes)} bytes)")
except Exception as e:
    print(f"Valid base64: NO — {e}")

print()
print("=== 2. JWT ROUNDTRIP (raw string vs decoded bytes) ===")
real_payload = {
    "sub": REAL_USER_ID,
    "aud": "authenticated",
    "role": "authenticated",
    "exp": int(time.time()) + 3600,
    "email": "jaemin.seo2111@gmail.com",
    "user_metadata": {"full_name": "C P"},
}

# Test 1: raw string
try:
    tok = jwt.encode(real_payload, secret, algorithm="HS256")
    dec = jwt.decode(tok, secret, algorithms=["HS256"], audience="authenticated")
    print(f"Raw string  : OK (sub={dec['sub'][:8]}...)")
    raw_token = tok
except Exception as e:
    print(f"Raw string  : FAILED — {e}")
    raw_token = None

# Test 2: base64-decoded bytes
try:
    key_bytes = base64.b64decode(secret + "==")
    tok2 = jwt.encode(real_payload, key_bytes, algorithm="HS256")
    dec2 = jwt.decode(tok2, key_bytes, algorithms=["HS256"], audience="authenticated")
    print(f"B64 bytes   : OK (sub={dec2['sub'][:8]}...)")
except Exception as e:
    print(f"B64 bytes   : FAILED — {e}")

print()
print("=== 3. DB LOOKUP ===")
try:
    from app.db.session import SessionLocal
    from app.repositories.user_repo import UserRepository
    db = SessionLocal()
    try:
        user = UserRepository(db).get_by_id(REAL_USER_ID)
        if user:
            print(f"Found user  : YES")
            print(f"email       : {user.email!r}")
            print(f"nickname    : {user.nickname!r}")
        else:
            print(f"Found user  : NO")
    finally:
        db.close()
except Exception as e:
    import traceback; traceback.print_exc()

print()
print("=== 4. LIVE /me HIT (self-signed token) ===")
if raw_token:
    req = urllib.request.Request(
        "http://localhost:8000/api/v1/me",
        headers={"Authorization": f"Bearer {raw_token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read())
            print(f"HTTP status : {resp.status}")
            print(f"ok          : {body.get('ok')}")
            d = body.get("data", {})
            print(f"email       : {d.get('email')!r}")
            print(f"nickname    : {d.get('nickname')!r}")
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}     : {e.read().decode()}")
    except Exception as e:
        print(f"ERROR       : {e}")
else:
    print("Skipped — no valid raw_token")

print()
print("=== DONE ===")
