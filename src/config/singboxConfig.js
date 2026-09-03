/**
 * Sing-box Configuration
 * Base configuration template for Sing-box client
 */

export const SING_BOX_CONFIG = {
    dns: {
        servers: [
            {"tag": "local", "type": "quic", "server": "223.5.5.5", "server_port": 853},
            {"tag": "node_dns", "type": "tls", "server": "dns.opendns.com", "domain_resolver": "local"},
            {"tag": "foreign", "type": "https", "server": "dns.google", "path": "/dns-query","domain_resolver": "local", "detour": "🐟 漏网之鱼"},  
            {"tag": "fakeip", "type": "fakeip", "inet4_range": "198.18.0.0/15", "inet6_range": "fc00::/18"}
        ],
        rules: [
            {"clash_mode": "direct", "server": "local"},
            {"clash_mode": "global", "server": "fakeip"},
            {"rule_set": ["category-ads-all"], "action": "predefined", "rcode": "NOERROR"},
            {"rule_set": ["geolocation-cn", "cn"], "server": "local"},
            {"query_type": ["A", "AAAA"], "server": "fakeip", "rewrite_ttl": 1}
        ],
        final: "foreign",
        client_subnet: "0.0.0.0/0"
    },
	ntp: {
		enabled: true,
		server: 'time.apple.com',
		server_port: 123,
		interval: '30m'
	},
	inbounds: [
		{"type": "mixed",  "tag": "mixed-in", "listen": "::", "listen_port": 5330, "sniff": true, "set_system_proxy": false},
    	{"type": "tun", "tag": "tun-in", "interface_name": "momo", "address": ["172.19.0.1/30", "fdfe:dcba:9876::1/126"], "mtu": 9000, "auto_route": false, "strict_route": true, "endpoint_independent_nat": true, "stack": "gvisor", "sniff": true}

	],
	outbounds: [
		{ type: "direct", tag: 'DIRECT' }
	],
	route: {
		"rule_set": [
			{
				"tag": "geosite-geolocation-!cn",
				"type": "local",
				"format": "binary",
				"path": "geosite-geolocation-!cn.srs"
			}
		],
		rules: [],
		auto_detect_interface: false,
		default_domain_resolver: "local",
		final: "🐟 漏网之鱼"
	},
	experimental: {
		cache_file: {
			enabled: true,
			store_fakeip: true
		}
	}
};

export const SING_BOX_CONFIG_V1_11 = {
	dns: {
		servers: [
			{
				tag: "dns_proxy",
				address: "tls://1.1.1.1",
				detour: "🚀 节点选择"
			},
			{
				tag: "dns_direct",
				address: "https://dns.alidns.com/dns-query",
				detour: "DIRECT",
				address_resolver: "dns_resolver"
			},
			{
				tag: "dns_resolver",
				address: "223.5.5.5",
				detour: "DIRECT"
			},
			{
				tag: "dns_fakeip",
				address: "fakeip"
			}
		],
		rules: [
			{
				rule_set: "geolocation-!cn",
				query_type: [
					"A",
					"AAAA"
				],
				server: "dns_fakeip"
			},
			{
				rule_set: "geolocation-!cn",
				query_type: "CNAME",
				server: "dns_proxy"
			},
			{
				query_type: [
					"A",
					"AAAA",
					"CNAME"
				],
				invert: true,
				server: "dns_direct",
				disable_cache: true
			}
		],
		final: "dns_direct",
		strategy: "prefer_ipv4",
		independent_cache: true,
		fakeip: {
			enabled: true,
			inet4_range: "198.18.0.0/15",
			inet6_range: "fc00::/18"
		}
	},
	ntp: {
		enabled: true,
		server: 'time.apple.com',
		server_port: 123,
		interval: '30m'
	},
	inbounds: [
		{ type: 'mixed', tag: 'mixed-in', listen: '0.0.0.0', listen_port: 2080 },
		{ type: 'tun', tag: 'tun-in', address: '172.19.0.1/30', auto_route: true, strict_route: true, stack: 'mixed' }
	],
	outbounds: [
		{ type: "direct", tag: 'DIRECT' }
	],
	route: {
		"rule_set": [],
		rules: []
	},
	experimental: {
		cache_file: {
			enabled: true,
			store_fakeip: true
		}
	}
};
