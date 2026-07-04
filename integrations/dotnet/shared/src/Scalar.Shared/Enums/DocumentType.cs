using System.ComponentModel;
using System.Text.Json.Serialization;
using NetEscapades.EnumGenerators;

#if SCALAR_ASPIRE
namespace Scalar.Aspire;
#else
namespace Scalar.AspNetCore;
#endif

/// <summary>
/// Specifies the type of an API document.
/// </summary>
[EnumExtensions]
[JsonConverter(typeof(DocumentTypeJsonConverter))]
public enum DocumentType
{
    /// <summary>
    /// An OpenAPI document.
    /// </summary>
    [Description("openapi")]
    OpenApi,

    /// <summary>
    /// An AsyncAPI document.
    /// </summary>
    [Description("asyncapi")]
    AsyncApi
}
