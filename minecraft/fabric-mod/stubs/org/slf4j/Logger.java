package org.slf4j;

public interface Logger {
    void info(String message);
    void info(String message, Object arg);
    void warn(String message);
    void error(String message, Throwable error);
    void error(String message, Object arg, Throwable error);
}
