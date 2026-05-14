package ids

import (
	"regexp"
	"testing"
)

func TestNewUUIDReturnsVersion4UUID(t *testing.T) {
	uuid := NewUUID()
	pattern := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	if !pattern.MatchString(uuid) {
		t.Fatalf("uuid %q does not match version 4 format", uuid)
	}
}
