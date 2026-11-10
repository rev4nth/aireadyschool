import redis

HOST = "coconut-hyperstylish-doting-33170.db.redis.io"
PORT = 17926
USER = "default"
PASSWORDS = [
    "LRK6R4s0MCGHv0oRnhTo/cQVqDpdpbVY",
    "LRK6R4s0MCGHv0oRnhTocQVqDpdpbVY",
]

for pw in PASSWORDS:
    for use_ssl in (False, True):
        try:
            client = redis.Redis(
                host=HOST,
                port=PORT,
                username=USER,
                password=pw,
                socket_connect_timeout=10,
                decode_responses=True,
                ssl=use_ssl,
                ssl_cert_reqs=None if use_ssl else None,
            )
            print("OK", "ssl=", use_ssl, "pw_has_slash=", "/" in pw, client.ping())
        except TypeError:
            # older/newer redis may reject ssl_cert_reqs when ssl=False
            try:
                kwargs = {
                    "host": HOST,
                    "port": PORT,
                    "username": USER,
                    "password": pw,
                    "socket_connect_timeout": 10,
                    "decode_responses": True,
                }
                if use_ssl:
                    kwargs["ssl"] = True
                client = redis.Redis(**kwargs)
                print("OK2", "ssl=", use_ssl, client.ping())
            except Exception as exc:  # noqa: BLE001
                print("FAIL2", "ssl=", use_ssl, type(exc).__name__, str(exc)[:140])
        except Exception as exc:  # noqa: BLE001
            print("FAIL", "ssl=", use_ssl, type(exc).__name__, str(exc)[:140])
