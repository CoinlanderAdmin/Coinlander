import secrets
import eth_keys
from eth_keys import keys
import sys

keyCount = int(sys.argv[1])
for i in range(keyCount):
    private_key = str(hex(secrets.randbits(256))[2:])
    private_key_bytes = bytes.fromhex(private_key)
    pk = keys.PrivateKey(private_key_bytes)
    public_address = pk.public_key.to_checksum_address()

    print('------------------------------------------------')
    print('Private key: ' + str(private_key))
    print('Public key: ' + str(public_address))
    print('------------------------------------------------')