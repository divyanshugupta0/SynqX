class SecurityVerification {
        constructor() {
            this.securityChecks = [
                { 
                    name: 'Browser Capabilities', 
                    check: () => !!window.navigator && !!window.screen 
                },
                { 
                    name: 'Storage Access', 
                    check: () => typeof window.localStorage !== 'undefined' && 
                                typeof window.sessionStorage !== 'undefined' 
                },
                { 
                    name: 'Crypto Support', 
                    check: () => typeof window.crypto === 'object' && 
                                typeof window.crypto.getRandomValues === 'function' 
                },
                { 
                    name: 'Modern Browser Features', 
                    check: () => typeof Promise === 'function' && 
                                typeof fetch === 'function' 
                },
                { 
                    name: 'Connection Security', 
                    check: async () => {
                        try {
                            // Multiple connection security checks
                            const checks = [
                                // Check online status
                                navigator.onLine,
                                
                                // Verify HTTPS
                                window.location.protocol === 'https:',
                                
                                // Test network connectivity
                                await this.testNetworkConnectivity(),
                                
                                // Check for secure context
                                window.isSecureContext,
                                
                                // Validate TLS support
                                this.validateTLSSupport()
                            ];

                            // Return true if at least 4 out of 5 checks pass
                            return checks.filter(Boolean).length >= 4;
                        } catch (error) {
                            console.error('Connection security check failed:', error);
                            return false;
                        }
                    }
                },
                { 
                    name: 'Platform Integrity', 
                    check: () => !this.detectVirtualEnvironment() 
                }
            ];
        }

        // Network connectivity test
        async testNetworkConnectivity() {
            const urls = [
                'https://www.google.com',
                'https://www.cloudflare.com',
                'https://www.microsoft.com'
            ];

            try {
                const tests = urls.map(async (url) => {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 3000);
                        
                        const response = await fetch(url, {
                            method: 'HEAD',
                            signal: controller.signal
                        });
                        
                        clearTimeout(timeoutId);
                        return response.ok;
                    } catch (error) {
                        return false;
                    }
                });

                // Pass if at least one connectivity test succeeds
                const results = await Promise.all(tests);
                return results.some(Boolean);
            } catch {
                return false;
            }
        }

        // Validate TLS support
        validateTLSSupport() {
            try {
                // Check for TLS minimum version support
                const tlsVersions = ['TLS 1.2', 'TLS 1.3'];
                
                // Basic TLS version detection (simplified)
                return tlsVersions.some(version => 
                    navigator.userAgent.includes(version)
                );
            } catch {
                return false;
            }
        }

        // Detect environment
        detectEnvironment() {
            const ua = navigator.userAgent.toLowerCase();
            return {
                platform: this.detectPlatform(ua),
                browser: this.detectBrowser(ua),
                os: this.detectOS(ua)
            };
        }

        // Detect platform type
        detectPlatform(ua) {
            if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
                return 'Mobile';
            }
            if (/tablet|ipad/i.test(ua)) {
                return 'Tablet';
            }
            return 'Desktop';
        }

        // Detect browser type
        detectBrowser(ua) {
            if (ua.includes('chrome')) return 'Chrome';
            if (ua.includes('firefox')) return 'Firefox';
            if (ua.includes('safari')) return 'Safari';
            if (ua.includes('edge')) return 'Edge';
            if (ua.includes('trident')) return 'Internet Explorer';
            return 'Unknown';
        }

        // Detect operating system
        detectOS(ua) {
            if (ua.includes('windows')) return 'Windows';
            if (ua.includes('mac')) return 'MacOS';
            if (ua.includes('linux')) return 'Linux';
            if (ua.includes('android')) return 'Android';
            if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
            return 'Unknown';
        }

        // Detect potential virtual or emulated environments
        detectVirtualEnvironment() {
            const virtualSignatures = [
                'phantom', 'selenium', 'webdriver',
                'electron', 'bot', 'crawler'
            ];

            return virtualSignatures.some(sig => 
                navigator.userAgent.toLowerCase().includes(sig)
            );
        }

        // Perform security checks
        async performSecurityChecks() {
            const results = await Promise.all(
                this.securityChecks.map(async (check) => ({
                    name: check.name,
                    passed: await check.check()
                }))
            );

            const passedChecks = results.filter(r => r.passed).length;
            const totalChecks = results.length;
            const passRate = (passedChecks / totalChecks) * 100;

            return {
                passed: passRate >= 75,
                results: results,
                environment: this.detectEnvironment()
            };
        }

        // Main verification method
        async verify() {
            try {
                return await this.performSecurityChecks();
            } catch (error) {
                console.error('Verification failed:', error);
                return { 
                    passed: false, 
                    error: error.message 
                };
            }
        }
    }

    // Verification process
    async function startVerification() {
        const verifier = new SecurityVerification();
        const securityChecksContainer = document.getElementById('security-checks');
        const progressBarFill = document.getElementById('progress-bar-fill');
        
        try {
            document.getElementById('verification-details').style.display = 'block';
            
            const result = await verifier.verify();
            
            // Render individual checks
            result.results.forEach((checkResult, index) => {
                const checkElement = document.createElement('div');
                checkElement.classList.add('check-item');
                
                const iconElement = document.createElement('div');
                iconElement.classList.add('check-icon', checkResult.passed ? 'success' : 'fail');
                iconElement.textContent = checkResult.passed ? '✓' : '✗';
                
                const textElement = document.createElement('span');
                textElement.textContent = checkResult.name;
                
                checkElement.appendChild(iconElement);
                checkElement.appendChild(textElement);
                securityChecksContainer.appendChild(checkElement);

                // Stagger the appearance of check items
                setTimeout(() => {
                    checkElement.classList.add('passed');
                }, index * 200);
            });

            // Animate progress bar
            const passRate = (result.results.filter(r => r.passed).length / result.results.length) * 100;
            setTimeout(() => {
                progressBarFill.style.width = `${passRate}%`;
            }, 500);
            
            if (result.passed) {
                document.getElementById('status-message').textContent = 'Verification Successful';
                
                // Optional: Redirect after successful verification
                setTimeout(() => {
                    // Replace with your target URL
                    window.location.href = "noxlogin.html"; 
                }, 2000);
            } else {
                throw new Error('Verification failed');
            }
        } catch (error) {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('error-message').style.display = 'block';
            document.getElementById('status-message').textContent = 'Access Denied';
            
            console.error('Verification error:', error);
        }
    }

    // Initialize verification on page load
    window.onload = startVerification;
