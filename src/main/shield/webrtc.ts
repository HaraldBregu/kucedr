export function webrtc(routed: boolean): 'disable_non_proxied_udp' | 'default_public_interface_only' {
	return routed ? 'disable_non_proxied_udp' : 'default_public_interface_only';
}
