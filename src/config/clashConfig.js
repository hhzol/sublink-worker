/**
 * Clash Configuration
 * Base configuration template for Clash client
 */

export const CLASH_CONFIG = {
	'port': 7890,
	'socks-port': 7891,
	'allow-lan': false,
	'mode': 'rule',
	'log-level': 'info',
	'rule-providers': {
		// 将由代码自动生成
	},
	'dns': {
		'enable': true,
		'listen': 7874,
		'ipv6': true,
		'respect-rules': true,
		'enhanced-mode': 'fake-ip',
		'proxy-server-nameserver': ['https://120.53.53.53/dns-query','https://223.5.5.5/dns-query'],
		'nameserver-policy': {
			'RULE-SET:cn': ['quic://223.5.5.5']
		},
		'nameserver': ['https://dns.google/dns-query#🐟 漏网之鱼'],
		'fake-ip-filter': ['*.lan','*.local','RULE-SET:cn']
	},
	'profile': {
		'store-selected': true,
		'store-fake-ip': true
	},
	'proxies': [],
	'proxy-groups': []
};
