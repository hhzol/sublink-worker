import { SING_BOX_CONFIG, generateRuleSets, generateRules, getOutbounds, PREDEFINED_RULE_SETS, DIRECT_DEFAULT_RULES, REJECT_ACTION_RULES, AI_RULES } from '../config/index.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { deepCopy, groupProxiesByCountry, CUSTOM_DATA, COUNTRY_DATA } from '../utils.js';
import { addProxyWithDedup } from './helpers/proxyHelpers.js';
import { buildSelectorMembers as buildSelectorMemberList, buildNodeSelectMembers, buildCustomRuleMembers, uniqueNames } from './helpers/groupBuilder.js';
import { normalizeGroupName } from './helpers/groupNameUtils.js';

const RULE_SET_HTTP_CLIENT_TAG = 'rule-set-download';

// 广告拦截相关的 outbound 名称
const AD_BLOCK_OUTBOUND_NAMES = new Set(['Ad Block', '🛑 广告拦截']);

// 把字符串或数组统一转成非空字符串数组
function toStringArray(value) {
    if (Array.isArray(value)) {
        return value.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim());
    }
    if (typeof value === 'string') {
        return value.split(',').map(x => x.trim()).filter(Boolean);
    }
    return [];
}

export class SingboxConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent, groupByCountry = false, enableClashUI = false, externalController, externalUiDownloadUrl, singboxVersion = '1.12', includeAutoSelect = true, fakeIpFilterDomains = '') {
        const resolvedBaseConfig = baseConfig ?? SING_BOX_CONFIG;
        super(inputString, resolvedBaseConfig, lang, userAgent, groupByCountry, includeAutoSelect);

        this.selectedRules = selectedRules;
        this.customRules = customRules;
        this.countryGroupNames = [];
        this.customGroupNames = [];
        this.manualGroupName = null;
        this.enableClashUI = enableClashUI;
        this.externalController = externalController;
        this.externalUiDownloadUrl = externalUiDownloadUrl;
        this.singboxVersion = singboxVersion;  // '1.11', '1.12' or '1.14'
        this.fakeIpFilterDomains = fakeIpFilterDomains;

        if (this.config?.dns?.servers?.length > 0) {
            this.config.dns.servers[0].detour = this.t('outboundNames.Node Select');
        }
    }

    isCompatibleProviderFormat(format) {
        if (this.singboxVersion === '1.11') {
            return false;
        }
        return format === 'singbox';
    }

    generateOutboundProviders() {
        const existingTags = this.getExistingProviderTags();
        return this.getAutoProviderDescriptors(existingTags).map(({ name, url }) => ({
            tag: name,
            type: 'http',
            download_url: url,
            path: `./providers/${name}.json`,
            download_interval: '24h',
            health_check: {
                enabled: true,
                url: 'https://www.gstatic.com/generate_204',
                interval: '5m'
            }
        }));
    }

    getProviderTags() {
        return this.getAutoProviderDescriptors(this.getExistingProviderTags()).map(provider => provider.name);
    }

    getExistingProviderTags() {
        return Array.isArray(this.config.outbound_providers)
            ? this.config.outbound_providers.map(p => p?.tag).filter(Boolean)
            : [];
    }

    getAllProviderTags() {
        if (this.singboxVersion === '1.11') {
            return [];
        }
        const existingTags = this.getExistingProviderTags();
        const autoTags = this.getProviderTags();
        return [...new Set([...existingTags, ...autoTags])];
    }

    getProxies() {
        return this.config.outbounds.filter(outbound => outbound?.server != undefined);
    }

    getProxyName(proxy) {
        return proxy.tag;
    }

    convertProxy(proxy) {
        const sanitized = { ...proxy };

        delete sanitized.udp;
        delete sanitized.network;

        if (sanitized.alpn && sanitized.tls) {
            if (!sanitized.tls.alpn) {
                sanitized.tls = { ...sanitized.tls, alpn: sanitized.alpn };
            }
            delete sanitized.alpn;
        } else if (sanitized.alpn && !sanitized.tls) {
            delete sanitized.alpn;
        }

        delete sanitized.packet_encoding;

        return sanitized;
    }

    addProxyToConfig(proxy) {
        this.config.outbounds = this.config.outbounds || [];
        addProxyWithDedup(this.config.outbounds, proxy, {
            getName: (item) => item?.tag,
            setName: (item, name) => {
                if (item) item.tag = name;
            },
            isSame: (existing = {}, incoming = {}) => {
                const { tag: _incomingTag, ...restIncoming } = incoming;
                const { tag: _existingTag, ...restExisting } = existing;
                return JSON.stringify(restIncoming) === JSON.stringify(restExisting);
            }
        });
    }

    hasOutboundTag(tag) {
        const target = normalizeGroupName(tag);
        return (this.config.outbounds || []).some(outbound => normalizeGroupName(outbound?.tag) === target);
    }

    hasAutoSelectCandidates(proxyList = this.getProxyList()) {
        return (Array.isArray(proxyList) && proxyList.length > 0) || this.getAllProviderTags().length > 0;
    }

    addAutoSelectGroup(proxyList) {
        if (!this.includeAutoSelect) return;
        this.config.outbounds = this.config.outbounds || [];
        const tag = this.t('outboundNames.Auto Select');
        if (this.hasOutboundTag(tag)) return;
        const providerTags = this.getAllProviderTags();
        const autoSelectMembers = deepCopy(uniqueNames(proxyList));
        if (autoSelectMembers.length === 0 && providerTags.length === 0) return;

        const group = {
            type: "urltest",
            tag,
            outbounds: autoSelectMembers
        };

        if (providerTags.length > 0) {
            group.providers = providerTags;
        }

        this.config.outbounds.unshift(group);
    }

    addNodeSelectGroup(proxyList) {
        this.config.outbounds = this.config.outbounds || [];
        const tag = this.t('outboundNames.Node Select');
        if (this.hasOutboundTag(tag)) return;
        const includeAutoSelect = this.includeAutoSelect && this.hasAutoSelectCandidates(proxyList);
        const members = buildNodeSelectMembers({
            proxyList,
            translator: this.t,
            groupByCountry: this.groupByCountry,
            manualGroupName: this.manualGroupName,
            countryGroupNames: this.countryGroupNames,
            customGroupNames: this.customGroupNames,
            includeAutoSelect,
            includeReject: false
        });

        const group = {
            type: "selector",
            tag,
            outbounds: members
        };

        const providerTags = this.getAllProviderTags();
        if (providerTags.length > 0) {
            group.providers = providerTags;
        }

        this.config.outbounds.unshift(group);
    }

    buildSelectorMembers(proxyList = []) {
        return buildSelectorMemberList({
            proxyList,
            translator: this.t,
            groupByCountry: this.groupByCountry,
            manualGroupName: this.manualGroupName,
            countryGroupNames: this.countryGroupNames,
            customGroupNames: this.customGroupNames,
            includeAutoSelect: this.includeAutoSelect && this.hasAutoSelectCandidates(proxyList),
            includeReject: false
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        outbounds.forEach(outbound => {
            if (outbound === this.t('outboundNames.Node Select')) return;
            if (REJECT_ACTION_RULES.has(outbound)) return;
            if (DIRECT_DEFAULT_RULES.has(outbound)) return;

            const tag = this.t(`outboundNames.${outbound}`);
            if (this.hasOutboundTag(tag)) return;

            let selectorMembers = this.buildSelectorMembers(proxyList);
            if (AI_RULES.has(outbound)) {
                selectorMembers = ['🎱 非香港节点', '🇺🇸 United States', this.t('outboundNames.Manual Switch')];
            }

            this.config.outbounds.push({
                type: "selector",
                tag,
                outbounds: selectorMembers
            });
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                if (this.hasOutboundTag(rule.name)) return;

                const isReject = REJECT_ACTION_RULES.has(rule.name);

                let selectorMembers;
                if (isReject) {
                    selectorMembers = ['REJECT', 'DIRECT', this.t('outboundNames.Node Select')];
                } else {
                    const includeAutoSelect = this.includeAutoSelect && this.hasAutoSelectCandidates(proxyList);
                    selectorMembers = buildCustomRuleMembers({
                        translator: this.t,
                        manualGroupName: this.manualGroupName,
                        countryGroupNames: this.countryGroupNames,
                        customGroupNames: this.customGroupNames,
                        includeAutoSelect
                    });
                }

                this.config.outbounds.push({
                    type: "selector",
                    tag: rule.name,
                    outbounds: selectorMembers
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        const selectorMembers = this.buildSelectorMembers(proxyList);
        if (this.hasOutboundTag(this.t('outboundNames.Fall Back'))) return;
        this.config.outbounds.push({
            type: "selector",
            tag: this.t('outboundNames.Fall Back'),
            outbounds: selectorMembers
        });
    }

    addCountryGroups() {
        if (!this.groupByCountry) {
            return;
        }

        const proxies = this.getProxies();
        const countryGroups = groupProxiesByCountry(proxies, {
            getName: proxy => this.getProxyName(proxy)
        });

        const providerTags = this.getAllProviderTags();

        if (providerTags.length > 0 && this.providerNodeNames?.length > 0) {
            const providerCountryGroups = groupProxiesByCountry(this.providerNodeNames, {
                getName: name => name
            });
            Object.keys(providerCountryGroups).forEach(country => {
                if (!countryGroups[country]) {
                    countryGroups[country] = { ...providerCountryGroups[country], proxies: [] };
                }
            });
        }

        const existingTags = new Set((this.config.outbounds || []).map(o => normalizeGroupName(o?.tag)).filter(Boolean));

        const manualProxyNames = proxies.map(p => p?.tag).filter(Boolean);
        const manualGroupName = manualProxyNames.length > 0 ? this.t('outboundNames.Manual Switch') : null;
        if (manualGroupName) {
            const manualNorm = normalizeGroupName(manualGroupName);
            if (!existingTags.has(manualNorm)) {
                const group = {
                    type: 'selector',
                    tag: manualGroupName,
                    outbounds: manualProxyNames
                };
                if (providerTags.length > 0) {
                    group.providers = providerTags;
                }
                this.config.outbounds.push(group);
                existingTags.add(manualNorm);
            }
        }

        this.countryGroupNames = [];
        this.customGroupNames = [];

        const countryOrder = Object.keys(COUNTRY_DATA);
        const customOrder = Object.keys(CUSTOM_DATA);
        const sortedCountries = Object.keys(countryGroups).sort((a, b) => {
            const idxA = countryOrder.indexOf(a);
            const idxB = countryOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return customOrder.indexOf(a) - customOrder.indexOf(b);
        });

        sortedCountries.forEach(countryCode => {
            const { emoji, name, aliases, exclude, proxies: memberProxies } = countryGroups[countryCode];
            const groupName = `${emoji} ${name}`;
            const norm = normalizeGroupName(groupName);
            if (existingTags.has(norm)) {
                if (CUSTOM_DATA[countryCode]) {
                    this.customGroupNames.push(groupName);
                } else {
                    this.countryGroupNames.push(groupName);
                }
                return;
            }

            const hasMembers = (memberProxies && memberProxies.length > 0) || providerTags.length > 0;
            if (!hasMembers) {
                return;
            }

            const group = {
                tag: groupName,
                type: 'urltest',
                outbounds: memberProxies || [],
                url: 'https://www.gstatic.com/generate_204',
                interval: '5m'
            };

            if (providerTags.length > 0) {
                group.providers = providerTags;
            }

            this.config.outbounds.push(group);
            existingTags.add(norm);

            if (CUSTOM_DATA[countryCode]) {
                this.customGroupNames.push(groupName);
            } else {
                this.countryGroupNames.push(groupName);
            }
        });

        const nodeSelectTag = this.t('outboundNames.Node Select');
        const nodeSelectGroup = this.config.outbounds.find(o => normalizeGroupName(o?.tag) === normalizeGroupName(nodeSelectTag));
        if (nodeSelectGroup && Array.isArray(nodeSelectGroup.outbounds)) {
            const includeAutoSelect = this.includeAutoSelect && this.hasAutoSelectCandidates(this.getProxyList());
            const rebuilt = buildNodeSelectMembers({
                proxyList: this.getProxyList(),
                translator: this.t,
                groupByCountry: true,
                manualGroupName,
                customGroupNames: this.customGroupNames,
                countryGroupNames: this.countryGroupNames,
                includeAutoSelect,
                includeReject: false
            });
            nodeSelectGroup.outbounds = rebuilt;
            if (providerTags.length > 0 && !nodeSelectGroup.providers) {
                nodeSelectGroup.providers = providerTags;
            }
        }

        this.manualGroupName = manualGroupName;
    }

    mergeUserProxyGroups(userGroups) {
        if (!Array.isArray(userGroups)) return;

        const proxyList = this.getProxyList();
        const validProxyTags = new Set(proxyList);
        const allProviderTags = new Set(this.getAllProviderTags());

        const groupTags = new Set(
            (this.config.outbounds || [])
                .filter(o => o.type === 'selector' || o.type === 'urltest')
                .map(o => normalizeGroupName(o?.tag))
                .filter(Boolean)
        );
        const validRefs = new Set(['DIRECT', 'direct']);
        proxyList.forEach(n => validRefs.add(n));
        groupTags.forEach(n => validRefs.add(n));

        userGroups.forEach(userGroup => {
            if (!userGroup?.name) return;

            const existingIndex = (this.config.outbounds || []).findIndex(o =>
                normalizeGroupName(o?.tag) === normalizeGroupName(userGroup.name)
            );

            if (existingIndex >= 0) {
                const existing = this.config.outbounds[existingIndex];

                if (Array.isArray(userGroup.use) && userGroup.use.length > 0) {
                    const validUserProviders = userGroup.use.filter(p => allProviderTags.has(p));
                    existing.providers = [...new Set([
                        ...(existing.providers || []),
                        ...validUserProviders
                    ])];
                }

                if (Array.isArray(userGroup.proxies) && userGroup.proxies.length > 0) {
                    const validUserOutbounds = userGroup.proxies.filter(p => validRefs.has(p));
                    existing.outbounds = [...new Set([
                        ...(existing.outbounds || []),
                        ...validUserOutbounds
                    ])];
                }

                if (userGroup.url) existing.url = userGroup.url;
                if (typeof userGroup.interval === 'number') {
                    existing.interval = `${userGroup.interval}s`;
                }
            } else {
                const newOutbound = {
                    type: userGroup.type === 'url-test' ? 'urltest' : 'selector',
                    tag: userGroup.name
                };

                if (Array.isArray(userGroup.proxies)) {
                    newOutbound.outbounds = userGroup.proxies.filter(p => validRefs.has(p));
                }

                if (Array.isArray(userGroup.use)) {
                    const validProviders = userGroup.use.filter(p => allProviderTags.has(p));
                    if (validProviders.length > 0) {
                        newOutbound.providers = validProviders;
                    }
                }

                if ((newOutbound.outbounds?.length > 0) || (newOutbound.providers?.length > 0)) {
                    this.config.outbounds.push(newOutbound);
                }
            }
        });
    }

    validateOutbounds() {
        const proxyList = this.getProxyList();
        const providerTags = this.getAllProviderTags();
        const invalidTags = new Set();

        (this.config.outbounds || []).forEach(outbound => {
            if (outbound.type === 'urltest' &&
                (!outbound.outbounds || outbound.outbounds.length === 0) &&
                (!outbound.providers || outbound.providers.length === 0)) {
                outbound.outbounds = [...proxyList];
                if (providerTags.length > 0) {
                    outbound.providers = [...providerTags];
                }
                if ((!outbound.outbounds || outbound.outbounds.length === 0) &&
                    (!outbound.providers || outbound.providers.length === 0)) {
                    invalidTags.add(normalizeGroupName(outbound.tag));
                }
            }
        });

        if (invalidTags.size > 0) {
            this.config.outbounds = (this.config.outbounds || [])
                .filter(outbound => !invalidTags.has(normalizeGroupName(outbound?.tag)))
                .map(outbound => {
                    if (Array.isArray(outbound.outbounds)) {
                        outbound.outbounds = outbound.outbounds.filter(tag => !invalidTags.has(normalizeGroupName(tag)));
                    }
                    return outbound;
                });
        }
    }

    sanitizeLegacySpecialOutbounds() {
        const legacyTags = new Set(
            (this.config.outbounds || [])
                .filter(outbound => outbound?.type === 'block' || outbound?.type === 'dns')
                .map(outbound => normalizeGroupName(outbound?.tag))
                .filter(Boolean)
        );
        legacyTags.add(normalizeGroupName('REJECT'));

        this.config.outbounds = (this.config.outbounds || [])
            .filter(outbound => !legacyTags.has(normalizeGroupName(outbound?.tag)))
            .map(outbound => {
                if (Array.isArray(outbound.outbounds)) {
                    outbound.outbounds = outbound.outbounds.filter(tag => !legacyTags.has(normalizeGroupName(tag)));
                }
                return outbound;
            })
            .filter(outbound => {
                if (outbound?.type !== 'selector' && outbound?.type !== 'urltest') return true;
                return outbound.outbounds?.length > 0 || outbound.providers?.length > 0;
            });
    }

    buildRouteTarget(rule) {
        if (REJECT_ACTION_RULES.has(rule?.outbound) || rule?.outbound === 'REJECT') {
            return { action: 'reject' };
        }
        if (DIRECT_DEFAULT_RULES.has(rule?.outbound)) {
            return { outbound: 'DIRECT' };
        }
        return { outbound: this.t(`outboundNames.${rule.outbound}`) };
    }

    configureRuleSetDownload() {
        if (this.singboxVersion === '1.14') {
            if (this.config.route.default_http_client) {
                return;
            }
            if (!Array.isArray(this.config.http_clients) || this.config.http_clients.length === 0) {
                this.config.http_clients = [{ tag: RULE_SET_HTTP_CLIENT_TAG, detour: 'DIRECT' }];
            }
            this.config.route.default_http_client = this.config.http_clients[0].tag;
            return;
        }
        this.config.route.rule_set.forEach(ruleSet => {
            if (ruleSet?.type === 'remote' && !ruleSet.download_detour) {
                ruleSet.download_detour = 'DIRECT';
            }
        });
    }

    /**
     * 广告拦截的 DNS 规则：
     *
     * 一、规则选择中勾选 "Ad Block"（显示为 🛑 广告拦截）：
     *     dns.rules 添加一条 { rule_set: ['category-ads-all'], action: 'predefined', rcode: 'NOERROR' }
     *
     * 二、自定义规则中出站名称为 "Ad Block" 或 "🛑 广告拦截"：
     *     按每条自定义规则生成一条 dns 规则，携带该规则的 domain_suffix / domain_keyword / site 等字段。
     *     site 字段映射到 rule_set。
     *
     * 三、一、二同时成立时：
     *     把 'category-ads-all' 合并进「二」生成的 rule_set；
     *     若「二」的 rule_set 为空，则补上 rule_set: ['category-ads-all']。
     *
     * 注意：route.rules 里不会出现 Ad Block 相关条目（在 formatConfig 中过滤掉了）。
     */
    configureAdBlockDnsRules() {
        if (!this.config?.dns || !Array.isArray(this.config.dns.rules)) return;

        // 1. 先清理所有已存在的 category-ads-all 规则
        this.config.dns.rules = this.config.dns.rules.filter(rule => {
            const rs = rule?.rule_set;
            if (Array.isArray(rs)) return !rs.includes('category-ads-all');
            if (typeof rs === 'string') return rs !== 'category-ads-all';
            return true;
        });

        // 2. 判断条件
        const outbounds = this.getOutboundsList();
        const fromSelected = Array.isArray(outbounds) && outbounds.includes('Ad Block');

        const matchedCustomRules = Array.isArray(this.customRules)
            ? this.customRules.filter(r => AD_BLOCK_OUTBOUND_NAMES.has(r?.name))
            : [];
        const fromCustom = matchedCustomRules.length > 0;

        if (!fromSelected && !fromCustom) return;

        // 3. 构建新的 dns 规则
        const newRules = [];

        if (fromCustom) {
            // 二：按每条自定义规则生成 dns 规则
            matchedCustomRules.forEach(cr => {
                const dnsRule = { action: 'predefined', rcode: 'NOERROR' };

                const domainSuffix = toStringArray(cr.domain_suffix);
                const domainKeyword = toStringArray(cr.domain_keyword);
                const siteList = toStringArray(cr.site);

                if (domainSuffix.length) dnsRule.domain_suffix = domainSuffix;
                if (domainKeyword.length) dnsRule.domain_keyword = domainKeyword;

                // 三：一、二同时成立时，把 category-ads-all 合并进去
                const ruleSet = [...siteList];
                if (fromSelected) ruleSet.push('category-ads-all');
                if (ruleSet.length) dnsRule.rule_set = ruleSet;

                newRules.push(dnsRule);
            });
        } else if (fromSelected) {
            // 一：只有规则选择
            newRules.push({
                rule_set: ['category-ads-all'],
                action: 'predefined',
                rcode: 'NOERROR'
            });
        }

        if (newRules.length === 0) return;

        // 4. 插到所有 clash_mode 规则之后
        let insertIdx = 0;
        this.config.dns.rules.forEach((r, i) => {
            if (r?.clash_mode) insertIdx = i + 1;
        });
        this.config.dns.rules.splice(insertIdx, 0, ...newRules);
    }

    /**
     * 把 form 里的 fakeIpFilterDomains 合并到 dns.rules 中
     * rule_set 包含 'cn' 或 'geolocation-cn' 的那条规则的 domain_suffix。
     * 该规则原本会让这些域名走 local 解析（不用 fakeip），
     * 加上自定义域名后，用户输入的域名也会走 local。
     */
    applyFakeIpFilterDomains() {
        if (!this.fakeIpFilterDomains || !this.fakeIpFilterDomains.trim()) return;
        if (!this.config?.dns || !Array.isArray(this.config.dns.rules)) return;

        const extras = this.fakeIpFilterDomains
            .split(',')
            .map(d => d.trim())
            .filter(Boolean);
        if (extras.length === 0) return;

        // 找到包含 geolocation-cn 或 cn 的规则（不修改原数组结构）
        const target = this.config.dns.rules.find(rule => {
            const rs = rule?.rule_set;
            if (!Array.isArray(rs)) return false;
            return rs.includes('geolocation-cn') || rs.includes('cn');
        });

        if (target) {
            // 把 extras 合并进这条规则的 domain_suffix（去重）
            const existing = Array.isArray(target.domain_suffix) ? target.domain_suffix : [];
            target.domain_suffix = [...new Set([...existing, ...extras])];
        } else {
            // 兜底：没找到目标规则时，退化为插一条独立规则
            this.config.dns.rules.push({
                rule_set: ['geolocation-cn', 'cn'],
                domain_suffix: extras,
                server: 'local'
            });
        }
    }

    formatConfig() {
        const allRules = generateRules(this.selectedRules, this.customRules);
        // route.rules 里不出现 Ad Block / 🛑 广告拦截 相关条目（这些交给 DNS 层处理）
        const rules = allRules.filter(r => !AD_BLOCK_OUTBOUND_NAMES.has(r.outbound));

        const { site_rule_sets, ip_rule_sets } = generateRuleSets(this.selectedRules, this.customRules);

        this.config.route.rule_set = [...site_rule_sets, ...ip_rule_sets];
        this.configureRuleSetDownload();
        this.configureAdBlockDnsRules();
        this.applyFakeIpFilterDomains();

        if (this.providerUrls.length > 0) {
            const existingProviders = Array.isArray(this.config.outbound_providers) ? this.config.outbound_providers : [];
            const newProviders = this.generateOutboundProviders();
            this.config.outbound_providers = [...existingProviders, ...newProviders];
        }

        this.validateOutbounds();
        this.sanitizeLegacySpecialOutbounds();

        const attachProtocolIfNeeded = (entry, rule) => {
            if (Array.isArray(rule?.protocol) && rule.protocol.length > 0) {
                entry.protocol = rule.protocol;
            }
            return entry;
        };

        const hasMatchValues = (value) => {
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value === 'string') return value.trim() !== '';
            return false;
        };

        rules.filter(rule => Array.isArray(rule.src_ip_cidr) && rule.src_ip_cidr.length > 0).map(rule => {
            this.config.route.rules.push(attachProtocolIfNeeded({
                source_ip_cidr: rule.src_ip_cidr,
                ...this.buildRouteTarget(rule)
            }, rule));
        });

        rules.filter(rule => hasMatchValues(rule.domain_suffix) || hasMatchValues(rule.domain_keyword)).map(rule => {
            const entry = {
                ...this.buildRouteTarget(rule)
            };

            if (hasMatchValues(rule.domain_suffix)) entry.domain_suffix = rule.domain_suffix;
            if (hasMatchValues(rule.domain_keyword)) entry.domain_keyword = rule.domain_keyword;

            this.config.route.rules.push(attachProtocolIfNeeded(entry, rule));
        });

        rules.filter(rule => !!rule.site_rules[0]).map(rule => {
            this.config.route.rules.push(attachProtocolIfNeeded({
                rule_set: [
                    ...(rule.site_rules.length > 0 && rule.site_rules[0] !== '' ? rule.site_rules : []),
                ],
                ...this.buildRouteTarget(rule)
            }, rule));
        });

        rules.filter(rule => !!rule.ip_rules[0]).map(rule => {
            this.config.route.rules.push(attachProtocolIfNeeded({
                rule_set: [
                    ...(rule.ip_rules
                        .map(ip => ip.trim())
                        .filter(ip => ip !== '')
                        .map(ip => `${ip}-ip`))
                ],
                ...this.buildRouteTarget(rule)
            }, rule));
        });

        rules.filter(rule => hasMatchValues(rule.ip_cidr)).map(rule => {
            this.config.route.rules.push(attachProtocolIfNeeded({
                ip_cidr: rule.ip_cidr,
                ...this.buildRouteTarget(rule)
            }, rule));
        });

        this.config.route.rules.unshift(
            { action: 'sniff' },
            { protocol: 'dns', action: 'hijack-dns' },
            { clash_mode: 'direct', outbound: 'DIRECT' },
            { clash_mode: 'global', outbound: this.t('outboundNames.Node Select') }
        );

        this.config.route.auto_detect_interface = true;
        this.config.route.final = this.t('outboundNames.Fall Back');
        if (this.enableClashUI || this.externalController || this.externalUiDownloadUrl) {
            const defaultExternalController = "0.0.0.0:9090";
            const defaultExternalUiDownloadUrl = "https://gh-proxy.com/https://github.com/Zephyruso/zashboard/archive/refs/heads/gh-pages.zip";
            const defaultExternalUi = "./ui";
            const defaultSecret = "";
            const defaultDownloadDetour = "DIRECT";
            const defaultClashMode = "rule";

            this.config.experimental = this.config.experimental || {};
            const existingClashApi = this.config.experimental.clash_api || {};

            const externalController = this.externalController || existingClashApi.external_controller || defaultExternalController;
            const externalUiDownloadUrl = this.externalUiDownloadUrl || existingClashApi.external_ui_download_url || defaultExternalUiDownloadUrl;
            const externalUi = existingClashApi.external_ui || defaultExternalUi;
            const secret = existingClashApi.secret ?? defaultSecret;
            const externalUiDownloadDetour = existingClashApi.external_ui_download_detour || defaultDownloadDetour;
            const clashMode = existingClashApi.default_mode || defaultClashMode;

            this.config.experimental.clash_api = {
                ...existingClashApi,
                external_controller: externalController,
                external_ui: externalUi,
                external_ui_download_url: externalUiDownloadUrl,
                external_ui_download_detour: externalUiDownloadDetour,
                secret,
                default_mode: clashMode
            };
        }
        return this.config;
    }
}