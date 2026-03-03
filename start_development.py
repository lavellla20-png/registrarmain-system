#!/usr/bin/env python3
"""
Development server starter with automatic IP detection
Detects current IP address and starts services for network access
"""

import subprocess
import socket
import sys
import os
from pathlib import Path

def get_local_ip():
    """Get the local IP address for network access"""
    try:
        # Create a socket to get local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Connect to a public DNS server (doesn't actually send data)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        # Fallback to localhost if detection fails
        return "127.0.0.1"

def start_backend(ip_address):
    """Start Django backend with network access"""
    print(f"🚀 Starting Django backend on {ip_address}:8001...")
    
    backend_dir = Path("backend")
    if not backend_dir.exists():
        print("❌ Backend directory not found!")
        return False
    
    try:
        # Change to backend directory and start server
        os.chdir(backend_dir)
        
        # Start Django with network binding
        cmd = [sys.executable, "manage.py", "runserver", f"{ip_address}:8001"]
        
        print(f"📡 Backend will be accessible at: http://{ip_address}:8001")
        print("🔄 Starting Django development server...")
        
        # Start the process
        subprocess.run(cmd, check=True)
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start backend: {e}")
        return False
    except KeyboardInterrupt:
        print("\n🛑 Backend server stopped by user")
        return False
    finally:
        # Return to original directory
        os.chdir("..")

def start_frontend(ip_address):
    """Start frontend development server"""
    print(f"🎨 Starting frontend on {ip_address}:5173...")
    
    frontend_dir = Path("frontend")
    if not frontend_dir.exists():
        print("❌ Frontend directory not found!")
        return False
    
    try:
        # Change to frontend directory
        os.chdir(frontend_dir)
        
        # Start Vite dev server with network binding
        cmd = ["npm", "run", "dev", "--", "--host", ip_address]
        
        print(f"🌐 Frontend will be accessible at: http://{ip_address}:5173")
        print("🔄 Starting Vite development server...")
        
        # Start the process
        subprocess.run(cmd, check=True)
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start frontend: {e}")
        return False
    except KeyboardInterrupt:
        print("\n🛑 Frontend server stopped by user")
        return False
    finally:
        # Return to original directory
        os.chdir("..")

def start_docker():
    """Start all services using Docker Compose"""
    print("🐳 Starting all services with Docker Compose...")
    
    try:
        # Check if docker-compose.yml exists
        if not Path("docker-compose.yml").exists():
            print("❌ docker-compose.yml not found!")
            return False
        
        # Start Docker Compose
        subprocess.run(["docker-compose", "up", "-d"], check=True)
        print("✅ Docker services started successfully!")
        
        # Show status
        subprocess.run(["docker-compose", "ps"])
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start Docker services: {e}")
        return False
    except FileNotFoundError:
        print("❌ Docker Compose not found. Please install Docker.")
        return False

def main():
    """Main function to start development environment"""
    print("🔧 Registrar System Development Starter")
    print("=" * 50)
    
    # Get current IP address
    ip_address = get_local_ip()
    print(f"📍 Detected IP Address: {ip_address}")
    print(f"🌍 Access URLs:")
    print(f"   Backend:  http://{ip_address}:8001")
    print(f"   Frontend: http://{ip_address}:5173")
    print(f"   Nginx:    http://{ip_address}:80 (if using Docker)")
    print()
    
    # Check command line arguments
    if len(sys.argv) > 1:
        service = sys.argv[1].lower()
        
        if service in ["backend", "django"]:
            start_backend(ip_address)
        elif service in ["frontend", "vite"]:
            start_frontend(ip_address)
        elif service in ["docker", "all"]:
            start_docker()
        else:
            print(f"❌ Unknown service: {service}")
            print("Available options: backend, frontend, docker")
            sys.exit(1)
    else:
        # Interactive mode
        print("🎯 Select service to start:")
        print("1. Backend (Django)")
        print("2. Frontend (Vite)")
        print("3. All Services (Docker)")
        print("4. Exit")
        
        try:
            choice = input("\nEnter choice (1-4): ").strip()
            
            if choice == "1":
                start_backend(ip_address)
            elif choice == "2":
                start_frontend(ip_address)
            elif choice == "3":
                start_docker()
            elif choice == "4":
                print("👋 Goodbye!")
            else:
                print("❌ Invalid choice!")
                
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")

if __name__ == "__main__":
    main()
