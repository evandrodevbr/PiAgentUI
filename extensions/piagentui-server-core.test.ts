import { describe, it, expect } from 'vitest'
import {
  isLoopbackHost,
  validateBearerToken,
  preventPathTraversal,
  validateHostAndOrigin,
  validateHostAndOriginForAccess,
  isRequestBodySizeAllowed,
  getLocalNetworkUrls,
  validateSttBaseUrl,
} from './piagentui-server-core.js'

describe('PiAgentUi Server Core Security Helpers', () => {
  describe('isLoopbackHost', () => {
    it('should accept loopback hostnames and IPs', () => {
      expect(isLoopbackHost('localhost')).toBe(true)
      expect(isLoopbackHost('127.0.0.1')).toBe(true)
      expect(isLoopbackHost('[::1]')).toBe(true)
      expect(isLoopbackHost('localhost:3000')).toBe(true)
      expect(isLoopbackHost('127.0.0.1:8080')).toBe(true)
    })

    it('should reject external and LAN hostnames or IPs', () => {
      expect(isLoopbackHost('192.168.1.1')).toBe(false)
      expect(isLoopbackHost('example.com')).toBe(false)
      expect(isLoopbackHost('0.0.0.0')).toBe(false)
      expect(isLoopbackHost('10.0.0.1')).toBe(false)
    })
  })

  describe('validateBearerToken', () => {
    const sampleToken = 'test-token-value-12345'

    it('should accept authorization headers with correct bearer token', () => {
      expect(validateBearerToken(`Bearer ${sampleToken}`, sampleToken)).toBe(true)
    })

    it('should reject headers with incorrect token', () => {
      expect(validateBearerToken(`Bearer wrong-token`, sampleToken)).toBe(false)
    })

    it('should reject headers with malformed format', () => {
      expect(validateBearerToken(`Basic ${sampleToken}`, sampleToken)).toBe(false)
      expect(validateBearerToken(sampleToken, sampleToken)).toBe(false)
      expect(validateBearerToken('', sampleToken)).toBe(false)
    })
  })

  describe('preventPathTraversal', () => {
    const baseDir = '/workspace/app/dist'

    it('should allow paths staying within the base directory', () => {
      expect(preventPathTraversal(baseDir, 'index.html')).toBe(true)
      expect(preventPathTraversal(baseDir, 'assets/main.js')).toBe(true)
    })

    it('should reject paths attempting to traverse out of the base directory', () => {
      expect(preventPathTraversal(baseDir, '../index.html')).toBe(false)
      expect(preventPathTraversal(baseDir, '../../etc/passwd')).toBe(false)
      expect(preventPathTraversal(baseDir, 'assets/../../config.json')).toBe(false)
    })
  })

  describe('validateHostAndOrigin', () => {
    it('should allow local host and local origin', () => {
      expect(validateHostAndOrigin('127.0.0.1', 'http://127.0.0.1:3000')).toBe(true)
      expect(validateHostAndOrigin('localhost', 'http://localhost')).toBe(true)
      expect(validateHostAndOrigin('localhost:5000', '')).toBe(true) // Optional origin
    })

    it('should reject non-local host or non-local origin', () => {
      expect(validateHostAndOrigin('127.0.0.1', 'http://malicious.com')).toBe(false)
      expect(validateHostAndOrigin('external.com', 'http://localhost')).toBe(false)
    })
  })

  describe('validateHostAndOriginForAccess', () => {
    it('should always allow loopback and only allow LAN hosts when enabled', () => {
      expect(validateHostAndOriginForAccess('127.0.0.1:58785', undefined, false)).toBe(true)
      expect(validateHostAndOriginForAccess('192.168.1.25:58785', undefined, false)).toBe(false)
      expect(validateHostAndOriginForAccess('192.168.1.25:58785', 'http://192.168.1.25:58785', true)).toBe(true)
      expect(validateHostAndOriginForAccess('192.168.1.25:58785', 'http://evil.test', true)).toBe(false)
    })
  })

  describe('getLocalNetworkUrls', () => {
    it('should build LAN URLs from non-internal IPv4 interfaces', () => {
      const urls = getLocalNetworkUrls(58785, {
        WiFi: [
          {
            address: '192.168.1.25',
            family: 'IPv4',
            internal: false,
            netmask: '255.255.255.0',
            mac: '00:00:00:00:00:01',
            cidr: '192.168.1.25/24',
          },
        ],
        Loopback: [
          {
            address: '127.0.0.1',
            family: 'IPv4',
            internal: true,
            netmask: '255.0.0.0',
            mac: '00:00:00:00:00:00',
            cidr: '127.0.0.1/8',
          },
        ],
      })

      expect(urls).toEqual(['http://192.168.1.25:58785'])
    })

    it('should prefer physical LAN adapters over WSL and Hyper-V virtual adapters', () => {
      const urls = getLocalNetworkUrls(58785, {
        'vEthernet (WSL (Hyper-V firewall))': [
          {
            address: '172.18.192.1',
            family: 'IPv4',
            internal: false,
            netmask: '255.255.240.0',
            mac: '00:15:5d:56:b1:b1',
            cidr: '172.18.192.1/20',
          },
        ],
        'vEthernet (Default Switch)': [
          {
            address: '172.25.224.1',
            family: 'IPv4',
            internal: false,
            netmask: '255.255.240.0',
            mac: '00:15:5d:15:fd:c0',
            cidr: '172.25.224.1/20',
          },
        ],
        Ethernet: [
          {
            address: '192.168.0.150',
            family: 'IPv4',
            internal: false,
            netmask: '255.255.255.0',
            mac: '34:5a:60:fb:39:42',
            cidr: '192.168.0.150/24',
          },
        ],
      })

      expect(urls).toEqual(['http://192.168.0.150:58785'])
    })
  })

  describe('validateSttBaseUrl', () => {
    it('should allow only HTTP(S) base URLs', () => {
      expect(validateSttBaseUrl('https://api.openai.com/v1')).toBe(true)
      expect(validateSttBaseUrl('http://localhost:11434/v1')).toBe(true)
      expect(validateSttBaseUrl('file:///tmp/key')).toBe(false)
      expect(validateSttBaseUrl('not a url')).toBe(false)
    })
  })

  describe('isRequestBodySizeAllowed', () => {
    it('should allow small request content sizes', () => {
      expect(isRequestBodySizeAllowed('100')).toBe(true)
      expect(isRequestBodySizeAllowed('1048576')).toBe(true) // 1MB
    })

    it('should reject extremely large content sizes', () => {
      expect(isRequestBodySizeAllowed('20000000')).toBe(false) // ~20MB
    })
  })
})
