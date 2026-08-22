package core

#BlockHeader: {
	hash:         string
	previousHash: string
	createdAt:    string                         // iso
	packer:       string & =~"^[A-Za-z0-9+/=]+$" // public key of the packer
	signature:    string
}
