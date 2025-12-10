#!/bin/bash
# choose-approach.sh - Help users choose the right air-gap deployment approach

set -e

echo "🤔 Cockpit-NG Air-Gap Deployment: Choose Your Approach"
echo "====================================================="
echo ""

# Function to print colored text
print_colored() {
    local color="$1"
    local text="$2"
    case "$color" in
        "green") echo -e "\033[32m$text\033[0m" ;;
        "blue") echo -e "\033[34m$text\033[0m" ;;
        "yellow") echo -e "\033[33m$text\033[0m" ;;
        "red") echo -e "\033[31m$text\033[0m" ;;
        *) echo "$text" ;;
    esac
}

echo "📋 Available Approaches:"
echo ""

print_colored "green" "1. All-in-One Approach (Recommended)"
echo "   ✅ Single Docker image file to transfer (~800MB)"
echo "   ✅ Simple deployment (one command)"
echo "   ✅ Complete self-contained solution"
echo "   ✅ Built-in health checks and monitoring"
echo "   ✅ Production-ready configuration"
echo ""
echo "   📁 Files to transfer: 1 (cockpit-ng-all-in-one.tar.gz)"
echo "   🚀 Commands: ./prepare-all-in-one.sh + ./deploy-all-in-one.sh"
echo "   📖 Documentation: docker/README-ALL-IN-ONE.md"
echo ""

print_colored "blue" "2. Modular Approach (Advanced)"
echo "   ⚙️ Separate base image and application bundle"
echo "   ⚙️ More flexibility for customization"
echo "   ⚙️ Reusable base image for multiple deployments"
echo "   ⚠️ More complex deployment process"
echo ""
echo "   📁 Files to transfer: 2 (base image + app bundle)"
echo "   🚀 Commands: ./prepare-airgap.sh + ./deploy-airgap.sh"
echo "   📖 Documentation: docker/README-AIRGAP.md"
echo ""

echo "🎯 Recommendation Matrix:"
echo "========================"
echo ""
printf "%-25s %-20s %-20s\n" "Scenario" "All-in-One" "Modular"
printf "%-25s %-20s %-20s\n" "------------------------" "-------------------" "-------------------"
printf "%-25s %-20s %-20s\n" "First-time deployment" "✅ Recommended" "❌ Overkill"
printf "%-25s %-20s %-20s\n" "Simple air-gap" "✅ Perfect" "❌ Too complex"
printf "%-25s %-20s %-20s\n" "Multiple deployments" "✅ Good" "✅ Efficient"
printf "%-25s %-20s %-20s\n" "Custom base image" "❌ Limited" "✅ Flexible"
printf "%-25s %-20s %-20s\n" "Quick deployment" "✅ Fast" "❌ Slower"
printf "%-25s %-20s %-20s\n" "Minimal transfer size" "✅ Single file" "❌ Multiple files"
printf "%-25s %-20s %-20s\n" "Production use" "✅ Ready" "✅ Ready"
echo ""

echo "💡 Quick Decision Helper:"
echo "========================"
echo ""

# Interactive decision helper
read -p "Is this your first air-gap deployment of Cockpit-NG? (y/n): " first_time
read -p "Do you need to customize the base system packages? (y/n): " custom_base
read -p "Will you deploy to multiple similar environments? (y/n): " multiple_deployments
read -p "Do you prefer simple, one-command deployment? (y/n): " simple_deployment

echo ""
echo "🎯 Recommendation based on your answers:"
echo ""

score_allinone=0
score_modular=0

if [[ "$first_time" =~ ^[Yy] ]]; then
    score_allinone=$((score_allinone + 2))
fi

if [[ "$custom_base" =~ ^[Yy] ]]; then
    score_modular=$((score_modular + 3))
else
    score_allinone=$((score_allinone + 1))
fi

if [[ "$multiple_deployments" =~ ^[Yy] ]]; then
    score_modular=$((score_modular + 1))
    score_allinone=$((score_allinone + 1))
fi

if [[ "$simple_deployment" =~ ^[Yy] ]]; then
    score_allinone=$((score_allinone + 2))
fi

if [ $score_allinone -gt $score_modular ]; then
    print_colored "green" "👑 RECOMMENDED: All-in-One Approach"
    echo ""
    echo "🚀 Get started:"
    echo "   1. Run: ./docker/prepare-all-in-one.sh"
    echo "   2. Transfer: docker/airgap-artifacts/cockpit-ng-all-in-one.tar.gz"
    echo "   3. Deploy: ./docker/deploy-all-in-one.sh"
    echo "   4. Validate: ./docker/validate-all-in-one.sh"
    echo ""
    echo "📖 Full guide: docker/README-ALL-IN-ONE.md"
elif [ $score_modular -gt $score_allinone ]; then
    print_colored "blue" "👑 RECOMMENDED: Modular Approach"
    echo ""
    echo "🚀 Get started:"
    echo "   1. Run: ./docker/prepare-airgap.sh"
    echo "   2. Transfer: docker/airgap-artifacts/* (multiple files)"
    echo "   3. Deploy: ./docker/deploy-airgap.sh"
    echo "   4. Validate: ./docker/validate-airgap.sh"
    echo ""
    echo "📖 Full guide: docker/README-AIRGAP.md"
else
    print_colored "yellow" "🤷 EITHER: Both approaches work for your use case"
    echo ""
    echo "💡 For simplicity, we suggest the All-in-One approach"
    echo ""
    echo "🚀 Quick start (All-in-One):"
    echo "   ./docker/prepare-all-in-one.sh"
fi

echo ""
echo "📚 Additional Resources:"
echo "======================="
echo "• All-in-One Guide: docker/README-ALL-IN-ONE.md"
echo "• Modular Guide: docker/README-AIRGAP.md"
echo "• Validation: docker/validate-*.sh"
echo "• Troubleshooting: Check the README files"
echo ""
echo "🎉 Ready to deploy Cockpit-NG in your air-gapped environment!"
