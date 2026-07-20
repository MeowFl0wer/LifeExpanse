"""Encryption and hashing of secrets held at rest."""

import pytest

from app.crypto import (
    decrypt, encrypt, generate_numeric_code, generate_recovery_code,
    hash_secret, verify_secret,
)


def test_encrypt_round_trips():
    assert decrypt(encrypt("JBSWY3DPEHPK3PXP")) == "JBSWY3DPEHPK3PXP"


def test_ciphertext_does_not_contain_the_plaintext():
    blob = encrypt("JBSWY3DPEHPK3PXP")
    assert "JBSWY3DPEHPK3PXP" not in blob


def test_the_same_secret_encrypts_differently_each_time():
    """A fresh nonce per message. Repeating ciphertext would reveal that two
    accounts share a secret."""
    a, b = encrypt("same-secret"), encrypt("same-secret")
    assert a != b
    assert decrypt(a) == decrypt(b) == "same-secret"


def test_tampering_is_detected():
    """GCM authenticates as well as encrypts, so a flipped byte fails loudly
    instead of decrypting to garbage."""
    blob = encrypt("JBSWY3DPEHPK3PXP")
    tampered = blob[:-4] + ("AAAA" if blob[-4:] != "AAAA" else "BBBB")
    with pytest.raises(Exception):
        decrypt(tampered)


def test_empty_values_pass_through():
    assert encrypt("") == ""
    assert decrypt("") == ""


def test_unknown_format_is_refused():
    with pytest.raises(ValueError):
        decrypt("not-a-ciphertext")


def test_hash_is_one_way_and_verifiable():
    hashed = hash_secret("123456")
    assert "123456" not in hashed
    assert verify_secret("123456", hashed)
    assert not verify_secret("123457", hashed)


def test_hash_ignores_surrounding_whitespace():
    assert verify_secret(" 123456 ", hash_secret("123456"))


def test_numeric_codes_are_six_digits_and_vary():
    codes = {generate_numeric_code() for _ in range(50)}
    assert all(len(c) == 6 and c.isdigit() for c in codes)
    # A generator that repeats itself is not a secret.
    assert len(codes) > 40


def test_recovery_codes_avoid_ambiguous_characters():
    """These get written down and typed back in, so 0/O and 1/I/L are out."""
    for _ in range(50):
        code = generate_recovery_code()
        assert "-" in code
        assert not set(code.replace("-", "")) & set("01ILOU")
