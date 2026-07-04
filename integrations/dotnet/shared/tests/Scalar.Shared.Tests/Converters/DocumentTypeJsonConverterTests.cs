using System.Text.Json;

namespace Scalar.Shared.Tests;

public class DocumentTypeJsonConverterTests
{
    [Fact]
    public void Converter_ShouldSerializeToStringFast()
    {
        // Arrange
        const DocumentType documentType = DocumentType.AsyncApi;

        // Act
        var json = JsonSerializer.Serialize(documentType, typeof(DocumentType), ScalarConfigurationSerializerContext.Default);

        // Assert
        json.Should().Be("\"asyncapi\"");
    }
}
