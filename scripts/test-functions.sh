#!/bin/bash

# Function Testing Script for FuncDock
# Tests all deployed functions with basic health checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
FUNCDOCK_URL=${FUNCDOCK_URL:-"http://localhost:3000"}
TIMEOUT=${TIMEOUT:-10}
VERBOSE=${VERBOSE:-false}

# Helper functions
log() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

verbose_log() {
    if [ "$VERBOSE" = "true" ]; then
        log $PURPLE "🔍 $1"
    fi
}

# Check if FuncDock is running
check_funcdock_status() {
    log $BLUE "🏥 Checking FuncDock platform status..."

    if ! curl -s --max-time $TIMEOUT "$FUNCDOCK_URL/health" > /dev/null; then
        log $RED "❌ FuncDock is not running or not accessible at $FUNCDOCK_URL"
        log $YELLOW "💡 Make sure to start FuncDock first: npm run dev"
        exit 1
    fi

    log $GREEN "✅ FuncDock is running"
}

# Get list of functions from platform
get_functions() {
    local status_response
    status_response=$(curl -s --max-time $TIMEOUT "$FUNCDOCK_URL/api/status" || echo '{"functions":[]}')
    echo "$status_response" | jq -r '.functions[]?.name // empty' 2>/dev/null || echo ""
}

# Test a specific function
test_function() {
    local function_name=$1
    local base_url="$FUNCDOCK_URL/$function_name"
    local tests_passed=0
    local tests_total=0

    log $BLUE "🧪 Testing function: $function_name"

    # Test 1: Basic GET request
    tests_total=$((tests_total + 1))
    verbose_log "Testing GET $base_url/"

    if response=$(curl -s --max-time $TIMEOUT -w "%{http_code}" "$base_url/" 2>/dev/null); then
        http_code="${response: -3}"
        response_body="${response%???}"

        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
            log $GREEN "  ✅ GET / - HTTP $http_code"
            tests_passed=$((tests_passed + 1))
            verbose_log "Response: $response_body"
        else
            log $RED "  ❌ GET / - HTTP $http_code"
            verbose_log "Response: $response_body"
        fi
    else
        log $RED "  ❌ GET / - Connection failed"
    fi

    # Test 2: OPTIONS request (CORS preflight)
    tests_total=$((tests_total + 1))
    verbose_log "Testing OPTIONS $base_url/"

    if response=$(curl -s --max-time $TIMEOUT -w "%{http_code}" -X OPTIONS "$base_url/" 2>/dev/null); then
        http_code="${response: -3}"

        if [ "$http_code" -eq 200 ]; then
            log $GREEN "  ✅ OPTIONS / - HTTP $http_code (CORS ready)"
            tests_passed=$((tests_passed + 1))
        else
            log $YELLOW "  ⚠️  OPTIONS / - HTTP $http_code"
        fi
    else
        log $YELLOW "  ⚠️  OPTIONS / - Connection failed"
    fi

    # Test 3: POST request with JSON body
    tests_total=$((tests_total + 1))
    verbose_log "Testing POST $base_url/ with JSON data"

    if response=$(curl -s --max-time $TIMEOUT -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"test": true, "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' \
        "$base_url/" 2>/dev/null); then

        http_code="${response: -3}"
        response_body="${response%???}"

        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
            log $GREEN "  ✅ POST / - HTTP $http_code"
            tests_passed=$((tests_passed + 1))
            verbose_log "Response: $response_body"
        else
            log $RED "  ❌ POST / - HTTP $http_code"
            verbose_log "Response: $response_body"
        fi
    else
        log $RED "  ❌ POST / - Connection failed"
    fi

    # Test 4: Invalid method (should return 405)
    tests_total=$((tests_total + 1))
    verbose_log "Testing PATCH $base_url/ (should return 405)"

    if response=$(curl -s --max-time $TIMEOUT -w "%{http_code}" -X PATCH "$base_url/" 2>/dev/null); then
        http_code="${response: -3}"

        if [ "$http_code" -eq 405 ]; then
            log $GREEN "  ✅ PATCH / - HTTP $http_code (correctly rejected)"
            tests_passed=$((tests_passed + 1))
        else
            log $YELLOW "  ⚠️  PATCH / - HTTP $http_code (expected 405)"
        fi
    else
        log $YELLOW "  ⚠️  PATCH / - Connection failed"
    fi

    # Test 5: Check if function has additional routes
    verbose_log "Checking for additional routes..."

    # Common additional routes to test
    local additional_routes=("status" "health" "test" "info")

    for route in "${additional_routes[@]}"; do
        if response=$(curl -s --max-time $TIMEOUT -w "%{http_code}" "$base_url/$route" 2>/dev/null); then
            http_code="${response: -3}"

            if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
                log $GREEN "  ✅ GET /$route - HTTP $http_code"
                verbose_log "Additional route found: /$route"
            fi
        fi
    done

    # Summary for this function
    local pass_rate=$((tests_passed * 100 / tests_total))
    if [ $tests_passed -eq $tests_total ]; then
        log $GREEN "  🎉 All tests passed ($tests_passed/$tests_total)"
    elif [ $tests_passed -gt 0 ]; then
        log $YELLOW "  ⚠️  Partial success ($tests_passed/$tests_total - $pass_rate%)"
    else
        log $RED "  💥 All tests failed ($tests_passed/$tests_total)"
    fi

    echo ""
    echo "$tests_passed $tests_total"
}

# Test platform endpoints
test_platform() {
    log $BLUE "🧪 Testing FuncDock platform endpoints..."
    local tests_passed=0
    local tests_total=0

    # Test platform status
    tests_total=$((tests_total + 1))
    if response=$(curl -s --max-time $TIMEOUT "$FUNCDOCK_URL/api/status" 2>/dev/null); then
        if echo "$response" | jq -e '.status' > /dev/null 2>&1; then
            log $GREEN "  ✅ Platform status endpoint"
            tests_passed=$((tests_passed + 1))
            verbose_log "Status response: $response"
        else
            log $RED "  ❌ Platform status endpoint - Invalid JSON"
        fi
    else
        log $RED "  ❌ Platform status endpoint - Connection failed"
    fi

    # Test health endpoint
    tests_total=$((tests_total + 1))
    if response=$(curl -s --max-time $TIMEOUT "$FUNCDOCK_URL/health" 2>/dev/null); then
        if echo "$response" | jq -e '.status' > /dev/null 2>&1; then
            log $GREEN "  ✅ Health check endpoint"
            tests_passed=$((tests_passed + 1))
            verbose_log "Health response: $response"
        else
            log $RED "  ❌ Health check endpoint - Invalid JSON"
        fi
    else
        log $RED "  ❌ Health check endpoint - Connection failed"
    fi

    # Test 404 handling
    tests_total=$((tests_total + 1))
    if response=$(curl -s --max-time $TIMEOUT -w "%{http_code}" "$FUNCDOCK_URL/nonexistent-route" 2>/dev/null); then
        http_code="${response: -3}"

        if [ "$http_code" -eq 404 ]; then
            log $GREEN "  ✅ 404 handling - HTTP $http_code"
            tests_passed=$((tests_passed + 1))
        else
            log $YELLOW "  ⚠️  404 handling - HTTP $http_code (expected 404)"
        fi
    else
        log $RED "  ❌ 404 handling - Connection failed"
    fi

    local pass_rate=$((tests_passed * 100 / tests_total))
    if [ $tests_passed -eq $tests_total ]; then
        log $GREEN "  🎉 Platform tests passed ($tests_passed/$tests_total)"
    else
        log $YELLOW "  ⚠️  Platform tests ($tests_passed/$tests_total - $pass_rate%)"
    fi

    echo ""
    echo "$tests_passed $tests_total"
}

# Main function
main() {
    local total_passed=0
    local total_tests=0
    local function_count=0

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --url)
                FUNCDOCK_URL="$2"
                shift 2
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --help|-h)
                log $BLUE "🧪 FuncDock Function Tester"
                echo ""
                log $YELLOW "Usage:"
                echo "  ./test-functions.sh [options]"
                echo ""
                log $YELLOW "Options:"
                echo "  --verbose, -v     Enable verbose output"
                echo "  --url <url>       FuncDock URL (default: http://localhost:3000)"
                echo "  --timeout <sec>   Request timeout (default: 10)"
                echo "  --help, -h        Show this help"
                echo ""
                log $YELLOW "Environment Variables:"
                echo "  FUNCDOCK_URL      FuncDock URL"
                echo "  TIMEOUT           Request timeout in seconds"
                echo "  VERBOSE           Enable verbose output (true/false)"
                exit 0
                ;;
            *)
                log $RED "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    log $BLUE "🚀 FuncDock Function Testing Suite"
    log $BLUE "================================="
    echo ""
    log $YELLOW "Configuration:"
    echo "  URL: $FUNCDOCK_URL"
    echo "  Timeout: ${TIMEOUT}s"
    echo "  Verbose: $VERBOSE"
    echo ""

    # Check if required tools are available
    if ! command -v curl &> /dev/null; then
        log $RED "❌ curl is required but not installed"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log $YELLOW "⚠️  jq is not installed - JSON parsing will be limited"
    fi

    # Check FuncDock status
    check_funcdock_status
    echo ""

    # Test platform endpoints
    platform_result=$(test_platform)
    platform_passed=$(echo "$platform_result" | tail -n1 | cut -d' ' -f1)
    platform_total=$(echo "$platform_result" | tail -n1 | cut -d' ' -f2)
    total_passed=$((total_passed + platform_passed))
    total_tests=$((total_tests + platform_total))

    # Get and test functions
    functions=$(get_functions)

    if [ -z "$functions" ]; then
        log $YELLOW "⚠️  No functions found to test"
        log $YELLOW "💡 Deploy some functions first: make deploy-git REPO=<repo> NAME=<name>"
    else
        log $BLUE "📋 Found functions to test:"
        echo "$functions" | while read -r func; do
            if [ -n "$func" ]; then
                log $YELLOW "  - $func"
                function_count=$((function_count + 1))
            fi
        done
        echo ""

        # Test each function
        while read -r function_name; do
            if [ -n "$function_name" ]; then
                func_result=$(test_function "$function_name")
                func_passed=$(echo "$func_result" | tail -n1 | cut -d' ' -f1)
                func_total=$(echo "$func_result" | tail -n1 | cut -d' ' -f2)
                total_passed=$((total_passed + func_passed))
                total_tests=$((total_tests + func_total))
            fi
        done <<< "$functions"
    fi

    # Final summary
    log $BLUE "📊 Test Summary"
    log $BLUE "==============="

    local overall_pass_rate=0
    if [ $total_tests -gt 0 ]; then
        overall_pass_rate=$((total_passed * 100 / total_tests))
    fi

    if [ $total_passed -eq $total_tests ]; then
        log $GREEN "🎉 All tests passed! ($total_passed/$total_tests)"
        echo ""
        log $GREEN "✨ Your FuncDock platform is working perfectly!"
    elif [ $total_passed -gt 0 ]; then
        log $YELLOW "⚠️  Some tests failed ($total_passed/$total_tests - $overall_pass_rate%)"
        echo ""
        log $YELLOW "💡 Check the logs above for details on failed tests"
    else
        log $RED "💥 All tests failed ($total_passed/$total_tests)"
        echo ""
        log $RED "🚨 Your FuncDock platform may have issues"
        exit 1
    fi

    exit 0
}

# Run main function
main "$@"
