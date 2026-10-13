package com.ecms;

import com.ecms.db.Database;
import com.ecms.handler.ApiHandler;
import com.ecms.handler.StaticHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

public class ElectionCommissionApp {

    private static final int DEFAULT_PORT = 8080;

    public static void main(String[] args) {
        System.out.println("====================================================================");
        System.out.println("      ELECTION COMMISSION MANAGEMENT SYSTEM (ECMS) - WEB SERVER     ");
        System.out.println("====================================================================");

        // 1. Initialize Database via JDBC
        System.out.println("[BOOT] Initializing Relational Database Schema via JDBC...");
        Database.initializeDatabase();

        // 2. Start HTTP Server
        int port = DEFAULT_PORT;
        if (args.length > 0) {
            try {
                port = Integer.parseInt(args[0]);
            } catch (NumberFormatException ignored) {}
        }

        HttpServer server = null;
        try {
            server = HttpServer.create(new InetSocketAddress(port), 0);
        } catch (IOException e) {
            System.out.println("[WARN] Port " + port + " occupied. Attempting port 8085...");
            try {
                port = 8085;
                server = HttpServer.create(new InetSocketAddress(port), 0);
            } catch (IOException ex) {
                System.err.println("[FATAL] Could not bind server to port: " + ex.getMessage());
                System.exit(1);
            }
        }

        // Attach Handlers
        server.createContext("/api", new ApiHandler());
        server.createContext("/", new StaticHandler("web"));
        server.setExecutor(Executors.newFixedThreadPool(10));
        server.start();

        System.out.println("[READY] ECMS Web Application is RUNNING!");
        System.out.println("[URL] Access the application in your browser at:");
        System.out.println("      >> http://localhost:" + port + "/");
        System.out.println("--------------------------------------------------------------------");
        System.out.println("Default Login Accounts:");
        System.out.println("  * Chief Election Commissioner (Admin): username: admin        | password: admin123");
        System.out.println("  * Registered Voter (New Delhi):         username: voter1       | password: voter123");
        System.out.println("  * Registered Voter (New Delhi):         username: voter2       | password: voter123");
        System.out.println("  * Registered Voter (Mumbai South):      username: voter3       | password: voter123");
        System.out.println("====================================================================");
    }
}

