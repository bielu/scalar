package com.scalar.maven.core.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Represents the type of a document rendered by the Scalar API Reference.
 */
public enum ScalarDocumentType {
    /**
     * An OpenAPI/Swagger document.
     */
    OPENAPI("openapi"),

    /**
     * An AsyncAPI document.
     */
    ASYNCAPI("asyncapi");

    private final String value;

    ScalarDocumentType(String value) {
        this.value = value;
    }

    /**
     * Creates a ScalarDocumentType from a string value.
     *
     * @param value the string value
     * @return the corresponding ScalarDocumentType
     * @throws IllegalArgumentException if the value is not recognized
     */
    @JsonCreator
    public static ScalarDocumentType fromValue(String value) {
        for (ScalarDocumentType documentType : values()) {
            if (documentType.value.equals(value)) {
                return documentType;
            }
        }
        throw new IllegalArgumentException("Unknown document type: " + value);
    }

    /**
     * Gets the string value for JSON serialization.
     *
     * @return the string value
     */
    @JsonValue
    public String getValue() {
        return value;
    }
}
